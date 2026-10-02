<?php
/**
 * Template Name: Frontend Tour Creator & Editor V3
 * Description: Front-end trip editor with direct device uploads, data-mapped upgrade engines, and day-wise accommodation galleries. Accessible to admins and partners.
 */

// Allow administrators and users with the partner role into the host trip studio.
if (!is_user_logged_in()) {
    wp_safe_redirect(wp_login_url('/add-your-own-trip'));
    exit;
}

$current_user    = wp_get_current_user();
$is_partner_user = (bool) array_intersect(array('partner', 'host'), (array) $current_user->roles);
$is_admin_user   = current_user_can('manage_options');

if (!$is_admin_user && !$is_partner_user) {
    wp_die(esc_html__('You do not have permission to use the Tripanza Host Trip Studio.', 'tripanza'));
}

global $wpdb;
$success_message = '';
$error_message = '';

$current_user_id = get_current_user_id();
$tour_id = isset($_GET['tour_id']) ? absint($_GET['tour_id']) : 0;
$is_edit = ($tour_id > 0 && get_post_type($tour_id) === 'st_tours');
$tour_post = $is_edit ? get_post($tour_id) : null;
$tripanza_launch_fee_pp = 500;

// Safeguard: If editing, partners can only modify their own posts
if ($is_edit && !current_user_can('manage_options') && intval($tour_post->post_author) !== $current_user_id) {
    wp_die('Unauthorized. You do not have permission to edit this tour listing.');
}

// A selected Tripanza-owned trip inherits its commission from the canonical trip.
// A host's own original trip may define the commission offered to other sellers.
$is_host_resale_copy = $is_edit && absint(get_post_meta($tour_id, 'host_parent_trip_id', true));
$is_read_only_resale = $is_host_resale_copy && !$is_admin_user;
$trip_owner = $is_edit ? get_userdata(absint($tour_post->post_author)) : $current_user;
$is_partner_owned_trip = !$is_host_resale_copy && $trip_owner && (bool) array_intersect(array('partner', 'host'), (array) $trip_owner->roles);

// Fetch Taxonomy Categories early so we can use them in the AI extraction prompt AND the form UI
$all_categories = get_terms(array(
    'taxonomy'   => 'st_tour_type',
    'hide_empty' => false,
));

$category_names = array();
if (!empty($all_categories) && !is_wp_error($all_categories)) {
    foreach ($all_categories as $cat) {
        $category_names[] = $cat->name;
    }
}
$allowed_categories_string = implode(', ', $category_names);


// --- HELPER FUNCTION: PARSE DIGITAL PDF TO PLAIN TEXT ---
if (!function_exists('ftc_pdf_to_text')) {
    function ftc_pdf_to_text($data) {
        if (!is_string($data) || empty($data)) {
            return '';
        }
        // Validate PDF signature
        if (strpos($data, '%PDF') !== 0) {
            return $data; 
        }

        $text = '';
        // Extract content within PDF streams
        preg_match_all('/<<.*?>>\s*stream\s*(.*?)\s*endstream/is', $data, $matches);
        
        foreach ($matches[1] as $stream) {
            // Attempt decompression using gzuncompress (native to standard PHP installations)
            $decompressed = @gzuncompress(trim($stream));
            if ($decompressed === false) {
                $decompressed = trim($stream);
            }
            
            // Extract textual strings from Begin Text (BT) to End Text (ET) operators
            if (preg_match_all('/BT\s+(.*?)\s+ET/is', $decompressed, $bt_blocks)) {
                foreach ($bt_blocks[1] as $block) {
                    preg_match_all('/\((.*?)\)\s*(?:Tj|[\d\s\-\.]+|TJ|\')/is', $block, $text_matches);
                    foreach ($text_matches[1] as $txt) {
                        $text .= stripcslashes($txt) . " ";
                    }
                }
            }
        }
        
        // Fallback: If no stream matches were indexed, harvest bracketed strings directly
        if (empty(trim($text))) {
            preg_match_all('/\((.*?)\)/s', $data, $fallback_matches);
            foreach ($fallback_matches[1] as $fallback) {
                if (strlen($fallback) > 3 && !preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', $fallback)) {
                    $text .= stripcslashes($fallback) . " ";
                }
            }
        }

        $text = preg_replace('/\s+/', ' ', $text);
        return trim($text);
    }
}

/**
 * Helper to retrieve stored API key
 * Safely wrapped to prevent fatal redeclaration errors
 */
if (!function_exists('whatsapp_ai_get_api_key')) {
    function whatsapp_ai_get_api_key() {
        return get_option('whatsapp_ai_openai_api_key', '');
    }
}

// --- AI ASSISTANT PROCESSING ENDPOINT ---
if (isset($_POST['action']) && 'ai_parse_itinerary' === sanitize_key(wp_unslash($_POST['action']))) {
    $ai_nonce = isset($_POST['ai_nonce']) ? sanitize_text_field(wp_unslash($_POST['ai_nonce'])) : '';
    if (!wp_verify_nonce($ai_nonce, 'ftc_ai_parse_itinerary')) {
        wp_send_json_error('This AI request expired. Refresh the page and try again.', 403);
    }

    $input_data = isset($_POST['raw_text']) ? trim(wp_unslash($_POST['raw_text'])) : '';
    if ('' === $input_data) {
        wp_send_json_error('Add an itinerary, a website URL, or a public PDF link first.', 400);
    }
    $input_data = substr($input_data, 0, 20000);
    
    // API key is stored in Tripanza settings.
    $api_key = whatsapp_ai_get_api_key();
    if (empty($api_key)) {
        wp_send_json_error('AI Auto-Fill is not configured yet. Add the OpenAI API key in Tripanza settings.', 503);
    }

    $content_to_parse = $input_data;

    // Check if input is a URL (Website, Direct PDF, or Google Drive Link)
    if (filter_var($input_data, FILTER_VALIDATE_URL)) {
        $download_url = $input_data;
        
        // Automatically convert Google Drive view links to direct download streams
        if (strpos($input_data, 'drive.google.com') !== false) {
            $file_id = '';
            if (preg_match('/\/file\/d\/([a-zA-Z0-9-_]+)/', $input_data, $id_match)) {
                $file_id = $id_match[1];
            } elseif (preg_match('/[?&]id=([a-zA-Z0-9-_]+)/', $input_data, $id_match)) {
                $file_id = $id_match[1];
            }
            
            if (!empty($file_id)) {
                $download_url = 'https://drive.google.com/uc?export=download&id=' . $file_id;
            }
        }

        $download_url = wp_http_validate_url($download_url);
        if (!$download_url) {
            wp_send_json_error('That URL is not safe or publicly accessible.', 400);
        }

        // Fetch only public, validated HTTP(S) targets.
        $scrape_response = wp_remote_get($download_url, array(
            'timeout'             => 25,
            'redirection'         => 3,
            'sslverify'           => true,
            'reject_unsafe_urls'  => true,
            'limit_response_size' => 5 * MB_IN_BYTES,
            'user-agent'          => 'Tripanza Itinerary Importer/1.0; ' . home_url('/'),
        ));

        if (is_wp_error($scrape_response)) {
            wp_send_json_error('Could not retrieve URL. If using Google Drive, verify sharing is set to "Anyone with the link". Error: ' . $scrape_response->get_error_message());
            exit;
        }

        $scrape_status = (int) wp_remote_retrieve_response_code($scrape_response);
        if ($scrape_status < 200 || $scrape_status >= 300) {
            wp_send_json_error('The itinerary URL could not be opened. Make sure it is public and try again.', 400);
        }

        $raw_body     = wp_remote_retrieve_body($scrape_response);
        $headers      = wp_remote_retrieve_headers($scrape_response);
        $content_type = isset($headers['content-type']) ? strtolower($headers['content-type']) : '';

        // Check if file is a PDF (by Header or File Signature)
        if (strpos($content_type, 'application/pdf') !== false || strpos($raw_body, '%PDF') === 0) {
            $pdf_text = ftc_pdf_to_text($raw_body);
            if (empty($pdf_text)) {
                wp_send_json_error('Downloaded PDF successfully, but it appears to be blank, a scanned image (OCR required), or password-protected.');
                exit;
            }
            $content_to_parse = $pdf_text;
        } else {
            // Process as standard HTML webpage
            $html_body = preg_replace('@<script[^>]*?>.*?</script>@si', '', $raw_body);
            $html_body = preg_replace('@<style[^>]*?>.*?</style>@si', '', $html_body);
            $content_to_parse = wp_strip_all_tags($html_body);
        }
        
        // Clean multiple spaces & truncate to save tokens
        $content_to_parse = substr(preg_replace('/\s+/', ' ', $content_to_parse), 0, 15000);
    }

    // Build OpenAI Extraction Request
    $prompt = 'You are an advanced travel agency itinerary extraction engine. Analyze the provided source text and build a strictly compliant JSON object matching this schema. If any data type is missing from the text, return an empty array for that key. Do not hallucinate data.

    Required JSON Keys:
    - tour_title (string: The official name of the trip)
    - tours_include (Provide a single string where each inclusion is on a brand new line. Use a single newline character (\n) to separate each item. Do not use commas, semicolons, or bullet points unless explicitly asked—just clean, line-by-line items.)
    - tours_exclude (Provide a single string where each exclusion is on a brand new line using a single newline (\n) to separate them.)
    - duration_day (string: e.g., "3N/4D" or "5 Days")
    - max_people (integer)
    - min_people (integer)
    - tour_destination (string)
    - address (string: Departure/starting location)
    - categories (array of strings: Analyze the destination, duration, and details of this itinerary, then return matching terms ONLY from this exact list of available categories: [' . esc_html($allowed_categories_string) . ']. Do not return categories not in this list.)
    
    
    
    
    - itinerary (array of objects: Extract each day details)
      Each object must contain:
      * title (string: The title of the day, e.g. "Day 1 :Arrival in Manali & Local Sightseeing")
     - For "desc": Do not write this as a continuous paragraph. Instead, format the days activities as a clean list where each major event, sightseeing stop, or activity is on a brand new line. Separate each item using a single newline character (\n).
      
    - faqs (array of objects: Extract any listed FAQs or general important guidelines/rules)
      Each object must contain:
      * title (string: The question text)
      * desc (string: The answer text)
      
    - availability (array of objects: Extract any specific operating departure dates and pricing options listed)
      Each object must contain:
      * date (string: The calendar date strictly in DD/MM/YYYY format)
      * quad (integer/numeric: Look for 4-sharing, Quad, or base package price. Return ONLY numbers. Use 0 if not found)
      * triple (integer/numeric: Look for 3-sharing, Triple, or extra bed price. Return ONLY numbers. Use 0 if not found)
      * twin (integer/numeric: Look for 2-sharing, Double occupancy, Twin, or couple price. Return ONLY numbers. Use 0 if not found)
      NOTE ON PRICING: Search the text deeply for sections like "Costing", "Package Price", "Tariff", or currency symbols (₹, $, Rs). If only ONE single price is listed for the whole tour, assign that same price to quad, triple, and twin.
    
    Source Content to Parse: ' . wp_kses_post($content_to_parse);

    $response = wp_remote_post('https://api.openai.com/v1/chat/completions', array(
        'headers' => array(
            'Authorization' => 'Bearer ' . $api_key,
            'Content-Type'  => 'application/json',
        ),
        'body' => wp_json_encode(array(
            'model' => 'gpt-4o', 
            'messages' => array(
                array('role' => 'system', 'content' => 'Output strictly valid JSON matching the schema. No markdown wrapping.'),
                array('role' => 'user', 'content' => $prompt)
            ),
            'response_format' => array('type' => 'json_object'),
            'temperature' => 0.1
        )),
        'timeout' => 45,
    ));

    if (is_wp_error($response)) {
        wp_send_json_error('API connection failed: ' . $response->get_error_message());
        exit;
    }

    $response_status = (int) wp_remote_retrieve_response_code($response);
    if ($response_status < 200 || $response_status >= 300) {
        wp_send_json_error('AI Auto-Fill is temporarily unavailable. Please try again in a moment.', 502);
    }

    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    
    if (isset($data['choices'][0]['message']['content'])) {
        $json_string = $data['choices'][0]['message']['content'];
        $parsed_data = json_decode($json_string, true);
        if (is_array($parsed_data)) {
            wp_send_json_success($parsed_data);
        }
        wp_send_json_error('AI returned an incomplete itinerary. Please try again.', 502);
    } else {
        wp_send_json_error('Failed to parse AI response.');
    }
    exit;
}


// Load the date-picker dependencies used by the operating-date fields.
wp_enqueue_script('jquery');
wp_enqueue_script('jquery-ui-core');
wp_enqueue_script('jquery-ui-datepicker');
// Enqueue a clean, modern jQuery UI theme styling for the interactive calendar
wp_enqueue_style('jquery-ui-style', 'https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/themes/smoothness/jquery-ui.css');

// Administrators can remove any published trip from the live site.
// This is a server-side permission boundary; hiding the button alone is not sufficient.
if (isset($_POST['tripanza_admin_tour_action'])) {
    if (!$is_admin_user) {
        wp_die(
            esc_html__('Only an administrator can change a trip publication status.', 'tripanza'),
            esc_html__('Access denied', 'tripanza'),
            array('response' => 403)
        );
    }

    $admin_tour_action = sanitize_key(wp_unslash($_POST['tripanza_admin_tour_action']));
    $admin_tour_id = isset($_POST['admin_tour_id']) ? absint($_POST['admin_tour_id']) : 0;
    $admin_tour_nonce = isset($_POST['tripanza_admin_tour_nonce'])
        ? sanitize_text_field(wp_unslash($_POST['tripanza_admin_tour_nonce']))
        : '';

    if (!wp_verify_nonce($admin_tour_nonce, 'tripanza_unpublish_tour_' . $admin_tour_id)) {
        $error_message = 'This unpublish request expired. Refresh the page and try again.';
    } elseif ('unpublish' !== $admin_tour_action) {
        $error_message = 'Unknown trip management action.';
    } else {
        $admin_tour_post = $admin_tour_id ? get_post($admin_tour_id) : null;

        if (!$admin_tour_post || 'st_tours' !== $admin_tour_post->post_type) {
            $error_message = 'The selected trip could not be found.';
        } elseif ('publish' !== $admin_tour_post->post_status) {
            $error_message = 'This trip is already unpublished.';
        } else {
            $unpublished_tour_id = wp_update_post(array(
                'ID'          => $admin_tour_id,
                'post_status' => 'draft',
            ), true);

            if (is_wp_error($unpublished_tour_id)) {
                $error_message = 'The trip could not be unpublished: ' . $unpublished_tour_id->get_error_message();
            } else {
                update_post_meta($admin_tour_id, '_tripanza_unpublished_by', $current_user_id);
                update_post_meta($admin_tour_id, '_tripanza_unpublished_at', current_time('mysql'));

                if (function_exists('tripanza_clear_post_pdf_cache')) {
                    tripanza_clear_post_pdf_cache($admin_tour_id);
                }

                wp_safe_redirect(add_query_arg(array(
                    'tab'                => 'manage',
                    'admin_tour_updated' => 'unpublished',
                    'admin_tour_id'      => $admin_tour_id,
                ), '/add-your-own-trip'));
                exit;
            }
        }
    }
}

if (isset($_POST['submit_tour_form']) && $is_read_only_resale) {
    $error_message = 'This hosted trip is linked to its master trip and is read-only. Only an administrator can change it.';
} elseif (isset($_POST['submit_tour_form'])) {
    $tour_nonce = isset($_POST['st_tour_nonce_field']) ? sanitize_text_field(wp_unslash($_POST['st_tour_nonce_field'])) : '';
    if (!wp_verify_nonce($tour_nonce, 'submit_st_tour_action')) {
        $error_message = 'This save request expired. Refresh the page and try again.';
    } else {
    
    $has_direct_file = static function ($key) {
        if (empty($_FILES[$key]['name'])) return false;
        return is_array($_FILES[$key]['name']) ? (bool) array_filter($_FILES[$key]['name']) : true;
    };
    // Existing attachment IDs and newly selected device files both satisfy the draft check.
    $use_featured_for_pdf = !empty($_POST['use_featured_for_pdf']);
    $required_media_missing = (empty($_POST['st_tours_image']) && !$has_direct_file('tp_featured_image_file'))
        || (!$use_featured_for_pdf && empty($_POST['_pdf_poster_image_id']) && !$has_direct_file('tp_pdf_cover_file'))
        || (empty($_POST['gallery']) && !$has_direct_file('tp_gallery_files'));

    $post_data = array(
        'post_title'   => sanitize_text_field($_POST['tour_title']),
        'post_content' => wp_kses_post($_POST['tour_content']),
        // Logic updated: If required images are missing, save as draft. Otherwise, follow default permissions rules.
        'post_status'  => $required_media_missing ? 'draft' : ($is_admin_user ? 'publish' : 'pending'),
        'post_type'    => 'st_tours',
    );

    if ($is_edit) {
        $post_data['ID'] = $tour_id;
        $post_id = wp_update_post($post_data);
    } else {
        $post_data['post_author'] = $current_user_id;
        $post_id = wp_insert_post($post_data);
    }

    if (is_wp_error($post_id) || $post_id === 0) {
        $error_message = 'Something went wrong. Could not process the tour profile.';
    } else {

        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        $media_upload_errors = array();
        $upload_image_file = static function ($file, $parent_id) use (&$media_upload_errors) {
            if (!is_array($file) || empty($file['name']) || (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) return 0;
            $temporary_key = 'tripanza_direct_' . wp_generate_password(12, false, false);
            $_FILES[$temporary_key] = $file;
            $attachment_id = media_handle_upload($temporary_key, $parent_id, array(), array('test_form' => false));
            unset($_FILES[$temporary_key]);
            if (is_wp_error($attachment_id)) {
                $media_upload_errors[] = $attachment_id->get_error_message();
                return 0;
            }
            if (!wp_attachment_is_image($attachment_id)) {
                wp_delete_attachment($attachment_id, true);
                $media_upload_errors[] = 'Only JPG, PNG, WebP or GIF images are allowed.';
                return 0;
            }
            return (int) $attachment_id;
        };

        $featured_image_id = absint($_POST['st_tours_image'] ?? 0);
        $pdf_cover_id = absint($_POST['_pdf_poster_image_id'] ?? 0);
        $gallery_ids = array_filter(array_map('absint', explode(',', sanitize_text_field(wp_unslash($_POST['gallery'] ?? '')))));

        foreach (array(
            'tp_featured_image_file' => 'featured_image_id',
            'tp_pdf_cover_file'      => 'pdf_cover_id',
        ) as $upload_key => $target_variable) {
            if (!empty($_FILES[$upload_key]['name'])) {
                $uploaded_id = $upload_image_file($_FILES[$upload_key], $post_id);
                if ($uploaded_id) ${$target_variable} = $uploaded_id;
            }
        }

        if ($use_featured_for_pdf) {
            $pdf_cover_id = $featured_image_id;
        }

        if (!empty($_FILES['tp_gallery_files']['name']) && is_array($_FILES['tp_gallery_files']['name'])) {
            $new_gallery_ids = array();
            foreach ($_FILES['tp_gallery_files']['name'] as $file_index => $file_name) {
                $gallery_file = array(
                    'name' => $file_name,
                    'type' => $_FILES['tp_gallery_files']['type'][$file_index] ?? '',
                    'tmp_name' => $_FILES['tp_gallery_files']['tmp_name'][$file_index] ?? '',
                    'error' => $_FILES['tp_gallery_files']['error'][$file_index] ?? UPLOAD_ERR_NO_FILE,
                    'size' => $_FILES['tp_gallery_files']['size'][$file_index] ?? 0,
                );
                $uploaded_id = $upload_image_file($gallery_file, $post_id);
                if ($uploaded_id) $new_gallery_ids[] = $uploaded_id;
            }
            if ($new_gallery_ids) $gallery_ids = $new_gallery_ids;
        }
        $gallery_ids = array_values(array_unique(array_filter(array_map('absint', $gallery_ids))));

        $uploaded_itinerary_urls = array();
        if (!empty($_FILES['tp_itinerary_image']['name']) && is_array($_FILES['tp_itinerary_image']['name'])) {
            foreach ($_FILES['tp_itinerary_image']['name'] as $day_index => $file_name) {
                $itinerary_file = array(
                    'name' => $file_name,
                    'type' => $_FILES['tp_itinerary_image']['type'][$day_index] ?? '',
                    'tmp_name' => $_FILES['tp_itinerary_image']['tmp_name'][$day_index] ?? '',
                    'error' => $_FILES['tp_itinerary_image']['error'][$day_index] ?? UPLOAD_ERR_NO_FILE,
                    'size' => $_FILES['tp_itinerary_image']['size'][$day_index] ?? 0,
                );
                $uploaded_id = $upload_image_file($itinerary_file, $post_id);
                if ($uploaded_id) $uploaded_itinerary_urls[(string) $day_index] = (string) wp_get_attachment_url($uploaded_id);
            }
        }

        $uploaded_accommodation_ids = array();
        if (!empty($_FILES['tp_accommodation_gallery']['name']) && is_array($_FILES['tp_accommodation_gallery']['name'])) {
            foreach ($_FILES['tp_accommodation_gallery']['name'] as $stay_index => $stay_files) {
                if (!is_array($stay_files)) continue;
                foreach ($stay_files as $file_index => $file_name) {
                    $stay_file = array(
                        'name' => $file_name,
                        'type' => $_FILES['tp_accommodation_gallery']['type'][$stay_index][$file_index] ?? '',
                        'tmp_name' => $_FILES['tp_accommodation_gallery']['tmp_name'][$stay_index][$file_index] ?? '',
                        'error' => $_FILES['tp_accommodation_gallery']['error'][$stay_index][$file_index] ?? UPLOAD_ERR_NO_FILE,
                        'size' => $_FILES['tp_accommodation_gallery']['size'][$stay_index][$file_index] ?? 0,
                    );
                    $uploaded_id = $upload_image_file($stay_file, $post_id);
                    if ($uploaded_id) $uploaded_accommodation_ids[(string) $stay_index][] = $uploaded_id;
                }
            }
        }

        if ($featured_image_id) {
            set_post_thumbnail($post_id, $featured_image_id);
        } else {
            delete_post_thumbnail($post_id);
        }

        // --- SAVE SELECTED CATEGORIES ---
        $selected_categories = isset($_POST['tour_categories']) && is_array($_POST['tour_categories']) ? array_map('intval', $_POST['tour_categories']) : array();
        wp_set_object_terms($post_id, $selected_categories, 'st_tour_type');

        $processed_itinerary = array();
        if (isset($_POST['itinerary']) && is_array($_POST['itinerary'])) {
            foreach ($_POST['itinerary'] as $day_index => $day) {
                $processed_itinerary[] = array(
                    'title' => sanitize_text_field($day['title']),
                    'desc'  => sanitize_textarea_field($day['desc']),
                    'image' => !empty($uploaded_itinerary_urls[(string) $day_index]) ? esc_url_raw($uploaded_itinerary_urls[(string) $day_index]) : (!empty($day['image']) ? esc_url_raw($day['image']) : '')
                );
            }
        }

        $processed_faqs = array();
        if (isset($_POST['faq']) && is_array($_POST['faq'])) {
            foreach ($_POST['faq'] as $fq) {
                if(!empty($fq['title'])) {
                    $processed_faqs[] = array(
                        'title' => sanitize_text_field($fq['title']),
                        'desc'  => sanitize_textarea_field($fq['desc'])
                    );
                }
            }
        }

        $processed_extras = array();
        if (isset($_POST['extra']) && is_array($_POST['extra'])) {
            foreach ($_POST['extra'] as $ex) {
                if(!empty($ex['title'])) {
                    $processed_extras[] = array(
                        'title'          => sanitize_text_field($ex['title']),
                        'price'          => !empty($ex['price']) ? sanitize_text_field($ex['price']) : '0',
                        'type'           => sanitize_text_field($ex['type']),
                        'extra_required' => isset($ex['required']) ? 'on' : 'off'
                    );
                }
            }
        }

        // --- PROCESSING ACCOMMODATION ARRAY ---
        $processed_accommodation = array();
        if (!empty($_POST['st_tours_accommodation']) && is_array($_POST['st_tours_accommodation'])) {
            foreach ($_POST['st_tours_accommodation'] as $stay_index => $item) {
                if (!empty($item['title'])) {
                    $amenities_arr = isset($item['amenities']) && is_array($item['amenities']) ? $item['amenities'] : [];
                    $stay_gallery_ids = array_filter(array_map('absint', explode(',', sanitize_text_field($item['gallery'] ?? ''))));
                    if (!empty($uploaded_accommodation_ids[(string) $stay_index])) {
                        $stay_gallery_ids = $uploaded_accommodation_ids[(string) $stay_index];
                    }
                    $stay_gallery_ids = array_values(array_unique(array_filter(array_map('absint', $stay_gallery_ids))));
                    $processed_accommodation[] = array(
                        'title'     => sanitize_text_field($item['title']),
                        'location'  => sanitize_text_field($item['location'] ?? ''),
                        'type'      => sanitize_text_field($item['type'] ?? ''),
                        'desc'      => sanitize_textarea_field($item['desc'] ?? ''),
                        'amenities' => sanitize_text_field(implode(', ', $amenities_arr)),
                        'gallery'   => implode(',', $stay_gallery_ids),
                    );
                }
            }
        }

        $required_media_missing = !$featured_image_id || !$pdf_cover_id || !$gallery_ids;
        if ($required_media_missing && get_post_status($post_id) !== 'draft') {
            wp_update_post(array('ID' => $post_id, 'post_status' => 'draft'));
        }

        $filtered_seats = array();
        $fallback_adult_price = 0;
        $fallback_child_price = 0;
        $fallback_infant_price = 0;
        $raw_tour_dates = array();
        if (isset($_POST['availability']) && is_array($_POST['availability'])) {
            foreach ($_POST['availability'] as $avail) {
                if (!empty($avail['date'])) {
                    $date_str = sanitize_text_field($avail['date']);
                    $normalized_date = str_replace('/', '-', $date_str);
                    $timestamp = strtotime($normalized_date);
                    
                    if ($timestamp) {
                        $formatted_key = date('d/m/Y', $timestamp);
                        $raw_tour_dates[] = date('Y-m-d', $timestamp);
                        $capacity = sanitize_text_field($_POST['max_people']);
                        $filtered_seats[$formatted_key] = $capacity;
                        if ($fallback_adult_price === 0) {
                            $fallback_adult_price = !empty($avail['quad']) ? floatval($avail['quad']) : 0;
                            $fallback_child_price = !empty($avail['triple']) ? floatval($avail['triple']) : 0;
                            $fallback_infant_price = !empty($avail['twin']) ? floatval($avail['twin']) : 0;
                        }
                    }
                }
            }
        }

        $tour_meta = array(
            'tours_program'                         => $processed_itinerary, 
            'tours_faq'                             => $processed_faqs,
            'extra_price'                           => $processed_extras,
            '_st_tours_accommodation'               => $processed_accommodation,
            'tours_program_style'                   => sanitize_text_field($_POST['tours_program_style']),
            'st_custom_layout_new'                  => !empty($_POST['st_custom_layout_new']) ? sanitize_text_field($_POST['st_custom_layout_new']) : '9', 
            '_itinerary_downloads'                  => esc_url_raw($_POST['_itinerary_downloads'] ?? ''), 
            'st_tours_image'                        => (string) $featured_image_id,
            'st_tours_media_type'                   => sanitize_text_field($_POST['st_tours_media_type'] ?? ''),
            // Keep the legacy secondary-cover key synced for existing Tripanza layouts.
            'st_tours_secondary_thumb'              => (string) $featured_image_id,
            'st_tours_video'                        => esc_url_raw($_POST['st_tours_video'] ?? ''),
            'gallery'                               => implode(',', $gallery_ids),
            '_pdf_poster_image_id'                  => (string) $pdf_cover_id,
            '_tripanza_pdf_uses_featured'           => $use_featured_for_pdf ? '1' : '0',
            'base_price'                            => $fallback_adult_price,
            'adult_price'                           => $fallback_adult_price,
            'child_price'                           => $fallback_child_price,
            'infant_price'                          => $fallback_infant_price,
            'min_price'                             => $fallback_adult_price, 
            'tour_price_by'                         => 'person',
            'dynamic_price_enabled'                 => 'off',
            'hide_adult_in_booking_form'            => isset($_POST['hide_adult_in_booking_form']) ? 'on' : 'off',
            'hide_children_in_booking_form'         => isset($_POST['hide_children_in_booking_form']) ? 'on' : 'off',
            'hide_infant_in_booking_form'           => isset($_POST['hide_infant_in_booking_form']) ? 'on' : 'off',
            'disable_adult_name'                    => isset($_POST['disable_adult_name']) ? 'on' : 'off',
            'disable_children_name'                 => isset($_POST['disable_children_name']) ? 'on' : 'off',
            'disable_infant_name'                   => isset($_POST['disable_infant_name']) ? 'on' : 'off',
            'duration_day'                          => sanitize_text_field($_POST['duration_day']),
            'max_people'                            => sanitize_text_field($_POST['max_people']),
            'min_people'                            => sanitize_text_field($_POST['min_people']),
            'status'                                => 'available',
            'type_tour'                             => 'specific_date', 
            'tours_booking_period'                  => sanitize_text_field($_POST['tours_booking_period']),
            '_seats_availability'                   => $filtered_seats,
            '_st_tour_dates'                        => implode(',', $raw_tour_dates),
            'address'                               => sanitize_text_field($_POST['address']),
            '_st_tour_destination'                  => sanitize_text_field($_POST['tour_destination']),
            '_st_tour_dropoff'                      => sanitize_text_field($_POST['tour_dropoff']),
            '_custom_tour_inclusions'               => sanitize_textarea_field($_POST['_custom_tour_inclusions'] ?? ''),
            '_st_tour_timer'                        => sanitize_text_field($_POST['_st_tour_timer'] ?? ''),
            '_st_tour_timer_note'                   => sanitize_text_field($_POST['_st_tour_timer_note'] ?? ''),
            '_st_tour_type_order'                   => sanitize_text_field($_POST['_st_tour_type_order'] ?? ''),
            '_st_lowest_price_message'              => sanitize_text_field($_POST['_st_lowest_price_message'] ?? ''),
            'deposit_payment_status'                => sanitize_text_field($_POST['deposit_payment_status']),
            'deposit_payment_amount'                => sanitize_text_field($_POST['deposit_payment_amount']),
            '_st_balance_payment_days'              => sanitize_text_field($_POST['_st_balance_payment_days']),
            'tours_highlight'                       => sanitize_textarea_field($_POST['tours_highlight']),
            'tours_include'                         => sanitize_textarea_field($_POST['tours_include']),
            'tours_exclude'                         => sanitize_textarea_field($_POST['tours_exclude']),
            'contact_email'                         => sanitize_email($_POST['contact_email'] ?? ''),
            'phone'                                 => sanitize_text_field($_POST['phone'] ?? ''),
            'website'                               => esc_url_raw($_POST['website'] ?? ''),
            '_st_tour_tag'                          => sanitize_text_field($_POST['tour_tag'] ?? ''),
            '_st_tour_tag_bg_color'                 => '#ff4e00',
            '_st_tour_tag_text_color'               => '#ffffff',
            'is_featured'                           => isset($_POST['is_featured']) ? 'on' : 'off',
            'is_meta_payment_gateway_st_submit_form'=> 'on',
        );

        // Original trip owners can set the seller commission. Canonical resale copies inherit it.
        if (!$is_host_resale_copy) {
            $commission_amount = isset($_POST['tripanza_host_commission_amount'])
                ? max(0, (float) wp_unslash($_POST['tripanza_host_commission_amount']))
                : 0;
            $tour_meta['tripanza_host_commission_amount'] = (string) $commission_amount;
        }

        // Launch pricing: Tripanza keeps a fixed ₹500 per confirmed traveller.
        // Any optional seller commission is additional and belongs to the trip owner.
        $saved_owner = get_userdata(absint(get_post_field('post_author', $post_id)));
        $is_partner_owned_inventory = !$is_host_resale_copy && $saved_owner
            && (bool) array_intersect(array('partner', 'host'), (array) $saved_owner->roles);
        if ($is_partner_owned_inventory) {
            $tour_meta['tripanza_platform_fee_pp'] = (string) $tripanza_launch_fee_pp;
            $tour_meta['tripanza_platform_fee_offer'] = 'launch_500';
        }

        foreach ($tour_meta as $key => $value) {
            update_post_meta($post_id, $key, $value);
        }

        if (isset($_POST['pdf_page_height'])) {
            update_post_meta($post_id, '_pdf_page_height', intval($_POST['pdf_page_height']));
        }

        if (function_exists('tripanza_get_display_sections')) {
            foreach (tripanza_get_display_sections() as $section_key => $section_label) {
                $field_name = 'tripanza_show_' . $section_key;
                update_post_meta($post_id, $field_name, isset($_POST[$field_name]) ? '1' : '0');
            }
            if (function_exists('tripanza_clear_post_pdf_cache')) {
                tripanza_clear_post_pdf_cache($post_id);
            }
        }

        $table_name = $wpdb->prefix . 'st_tour_availability';
        $wpdb->delete($table_name, array('post_id' => $post_id));
        if (isset($_POST['availability']) && is_array($_POST['availability'])) {
            foreach ($_POST['availability'] as $row) {
                if (empty($row['date'])) continue;
                $date_str = sanitize_text_field($row['date']);
                $normalized_date = str_replace('/', '-', $date_str);
                $check_in_timestamp = strtotime($normalized_date);
                if ($check_in_timestamp) {
                    $wpdb->insert(
                        $table_name,
                        array(
                            'post_id'        => $post_id,
                            'check_in'       => $check_in_timestamp, 
                            'check_out'      => $check_in_timestamp,  
                            'adult_price'    => !empty($row['quad']) ? sanitize_text_field($row['quad']) : 0,
                            'child_price'    => !empty($row['triple']) ? sanitize_text_field($row['triple']) : 0,
                            'infant_price'   => !empty($row['twin']) ? sanitize_text_field($row['twin']) : 0,
                            'status'         => 'available',
                            'number'         => sanitize_text_field($_POST['max_people']),
                            'booking_period' => sanitize_text_field($_POST['tours_booking_period'])
                        )
                    );
                }
            }
        }

        do_action('save_post_st_tours', $post_id, get_post($post_id), true);
        do_action('save_post', $post_id, get_post($post_id), true);

        if (!$is_edit) {
            wp_safe_redirect(add_query_arg(array('tour_id' => $post_id, 'updated' => 'true', 'is_draft' => $required_media_missing ? '1' : '0', 'media_upload_error' => $media_upload_errors ? '1' : '0'), '/add-your-own-trip'));
            exit;
        }

        if ($media_upload_errors) {
            $error_message = 'Some selected images could not be uploaded. Check their format and file size, then try those images again.';
        }

        if ($required_media_missing) {
            $success_message = '<strong>Saved as draft.</strong> Add the required images when you are ready to send this trip for review.';
        } else {
            $success_message = '<strong>Trip updated.</strong> ' .
            '<a href="' . get_permalink($post_id) . '" target="_blank" style="color: #28a745; text-decoration: underline;">View Live Layout</a>';
        }
    }
    }
}

if (isset($_GET['updated']) && $_GET['updated'] == 'true') {
    if (isset($_GET['is_draft']) && $_GET['is_draft'] == '1') {
        $success_message = '<strong>Saved as draft.</strong> Add the required images when you are ready to send this trip for review.';
    } else {
        $success_message = '<strong>Trip submitted successfully.</strong> ' .
        '<a href="' . get_permalink($tour_id) . '" target="_blank" style="color: #28a745; text-decoration: underline;">View Live Layout</a>';
    }
}
if (!empty($_GET['media_upload_error'])) {
    $error_message = 'Some selected images could not be uploaded. Check their format and file size, then try those images again.';
}
if ($is_admin_user && isset($_GET['admin_tour_updated']) && 'unpublished' === sanitize_key(wp_unslash($_GET['admin_tour_updated']))) {
    $unpublished_notice_id = isset($_GET['admin_tour_id']) ? absint($_GET['admin_tour_id']) : 0;
    $unpublished_notice_title = $unpublished_notice_id ? get_the_title($unpublished_notice_id) : '';
    $success_message = $unpublished_notice_title
        ? '<strong>Trip unpublished.</strong> ' . esc_html($unpublished_notice_title) . ' is now a draft and is no longer live.'
        : '<strong>Trip unpublished.</strong> It is now a draft and is no longer live.';
}

$meta_data = array();
if ($is_edit) {
    $all_meta = get_post_meta($tour_id);
    $inherited_edit_meta_keys = array(
        'tours_highlight', 'tours_include', 'tours_exclude', 'tours_program',
        'tours_faq', '_st_tours_faq_repeater', 'extra_price',
        '_st_tours_accommodation', 'tours_program_style', 'duration_day',
        'min_people', 'max_people', 'tours_booking_period', 'address',
        '_st_tour_destination', '_st_tour_dropoff', '_seats_availability',
        '_st_tour_dates', 'location_id', 'location_country', '_st_tours_sold_out',
        'base_price', 'min_price', 'price', 'sale_price', 'adult_price',
        'child_price', 'infant_price', 'discount', 'discount_type',
        'discount_by_people_type', 'discount_by_adult', 'discount_by_child',
        'deposit_payment_amount', 'deposit_payment_status', '_st_balance_payment_days',
        'disable_adult_name', 'disable_children_name', 'disable_infant_name',
        'hide_adult_in_booking_form', 'hide_children_in_booking_form',
        'hide_infant_in_booking_form', 'duration', 'duration_night', 'type_tour',
        'tour_price_by', 'booking_period', '_st_tour_timer', '_st_tour_timer_note',
        '_st_tour_type_order', '_st_lowest_price_message', 'cancellation_policy',
        'cancel_policy', 'st_tour_external_booking', 'st_tour_external_booking_link',
        '_st_tours_coupon_code', '_st_tours_emi_months', 'tour_reel_videos',
        'tripanza_promoted_departure_date', 'tripanza_promoted_badge',
        'tripanza_promoted_benefit', 'tripanza_promoted_until',
        'tripanza_host_commission_amount', 'tripanza_cashback_pp',
    );
    $edit_meta_keys = array_unique(array_merge(array_keys($all_meta), $inherited_edit_meta_keys));

    /* Hosted storefront copies intentionally do not duplicate operational
     * repeaters. Resolve their canonical inventory post here as well as via
     * the global metadata filter so this editor works even when that filter
     * has not been loaded on a standalone page-template request. */
    $edit_inventory_tour_id = $tour_id;
    if (function_exists('tripanza_get_inventory_trip_id')) {
        $resolved_inventory_id = absint(tripanza_get_inventory_trip_id($tour_id));
        if ($resolved_inventory_id && get_post_type($resolved_inventory_id) === 'st_tours') {
            $edit_inventory_tour_id = $resolved_inventory_id;
        }
    }
    if ($edit_inventory_tour_id === $tour_id && $is_host_resale_copy) {
        $parent_tour_id = absint(get_post_meta($tour_id, 'host_parent_trip_id', true));
        if ($parent_tour_id && get_post_type($parent_tour_id) === 'st_tours') {
            $edit_inventory_tour_id = $parent_tour_id;
        }
    }

    /* Read each key separately so get_post_metadata filters can resolve values
     * inherited from a canonical parent trip. A bulk get_post_meta($tour_id)
     * call does not pass a meta key to those filters, leaving hosted-copy edit
     * forms blank even though the published tour displays the data. */
    foreach ($edit_meta_keys as $key) {
        $meta_post_id = $edit_inventory_tour_id !== $tour_id && in_array($key, $inherited_edit_meta_keys, true)
            ? $edit_inventory_tour_id
            : $tour_id;
        $meta_data[$key] = maybe_unserialize(get_post_meta($meta_post_id, $key, true));
    }
}

$normalize_editor_repeater = static function ($value) {
    // Older imports can be serialized or JSON-encoded more than once.
    for ($pass = 0; $pass < 3; $pass++) {
        $previous = $value;
        $value = maybe_unserialize($value);
        if (is_string($value) && trim($value) !== '') {
            $decoded = json_decode($value, true);
            if (json_last_error() === JSON_ERROR_NONE) $value = $decoded;
        }
        if ($value === $previous || is_array($value)) break;
    }
    if (!is_array($value)) return array();

    // Accept API wrappers without mistaking a single repeater row for a list.
    foreach (array('items', 'data', 'rows', 'value') as $wrapper_key) {
        if (isset($value[$wrapper_key]) && is_array($value[$wrapper_key])) {
            $value = $value[$wrapper_key];
            break;
        }
    }
    if (count($value) === 1 && array_key_exists(0, $value) && is_string($value[0])) {
        $nested = maybe_unserialize($value[0]);
        if (is_string($nested)) {
            $decoded = json_decode($nested, true);
            if (json_last_error() === JSON_ERROR_NONE) $nested = $decoded;
        }
        if (is_array($nested)) $value = $nested;
    }

    $keys = array_keys($value);
    $is_list = $keys === range(0, count($value) - 1);
    if (!$is_list && array_intersect(array('title', 'heading', 'desc', 'description', 'location', 'type'), $keys)) {
        $value = array($value);
    }
    return array_values($value);
};

$normalize_editor_text = static function ($value) {
    $value = maybe_unserialize($value);
    if (is_string($value)) {
        $decoded = json_decode($value, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) $value = $decoded;
    }
    if (!is_array($value)) return (string) $value;
    $lines = array();
    array_walk_recursive($value, static function ($item) use (&$lines) {
        if (is_scalar($item) && trim((string) $item) !== '') $lines[] = trim((string) $item);
    });
    return implode("\n", $lines);
};

// Prefer the native WordPress featured image, then gracefully migrate older cover metadata.
$saved_featured_cover_id = $is_edit ? absint(get_post_thumbnail_id($tour_id)) : 0;
if (!$saved_featured_cover_id) {
    $saved_featured_cover_id = absint($meta_data['st_tours_image'] ?? 0);
}
if (!$saved_featured_cover_id) {
    $saved_featured_cover_id = absint($meta_data['st_tours_secondary_thumb'] ?? 0);
}
$saved_featured_cover_url = $saved_featured_cover_id ? wp_get_attachment_url($saved_featured_cover_id) : '';
$saved_pdf_cover_id = absint($meta_data['_pdf_poster_image_id'] ?? 0);
$saved_pdf_uses_featured = !empty($meta_data['_tripanza_pdf_uses_featured'])
    || ($saved_featured_cover_id && $saved_pdf_cover_id === $saved_featured_cover_id);

$saved_categories = array();
if ($is_edit) {
    $saved_terms = wp_get_post_terms($tour_id, 'st_tour_type', array('fields' => 'ids'));
    if (!is_wp_error($saved_terms)) {
        $saved_categories = $saved_terms;
    }
}

// Prepare Amenities Matrix
$amenities_list = [
    'Free Parking', 'Bonfire (On Request)', 'Restaurant (Halal,Kosher)', 'Fireplace (Outdoor)',
    'Butler Services', 'Lounge (Shared)', 'Smoking Rooms', 'Power Backup', 'Elevator/Lift',
    'Refrigerator', 'Housekeeping', 'Umbrellas', 'Room Service (Limited duration)',
    'Laundry Service (Paid)', 'Air Conditioning (Room controlled)', 'Smoke Detector (Lobby)',
    'Free Wi-Fi', 'Doctor on Call', 'Bellboy Service', 'Caretaker', 'Iron/Ironing Board',
    'Mini Fridge', 'Terrace', 'Geyser/Water Heater', 'Toiletries', 'Dining Area',
    'Mineral Water', 'Heater - Additional charges (Paid)', 'Balcony (Private)', 'CCTV',
    'Fire Extinguishers', 'Security alarms', 'Outdoor Activities and Sports', 'Lawn',
    'Reception', 'Balcony/Terrace', 'Seating Area', 'Outdoor Furniture', 'swimming pool',
    'Private washroom', 'Gaming Area', 'DJ Night Area', 'Bonfire Area', 'Playstation',
    'Table Tennis', 'Billiard'
];

// Read preloaded data from native arrays, serialized values, or API-saved JSON.
$saved_highlight_text = $normalize_editor_text($meta_data['tours_highlight'] ?? '');
$saved_include_text   = $normalize_editor_text($meta_data['tours_include'] ?? ($meta_data['_tour_inclusions'] ?? ''));
$saved_exclude_text   = $normalize_editor_text($meta_data['tours_exclude'] ?? '');
$saved_itinerary      = $normalize_editor_repeater($meta_data['tours_program'] ?? array());
$saved_faqs           = $normalize_editor_repeater($meta_data['tours_faq'] ?? ($meta_data['_st_tours_faq_repeater'] ?? array()));
$saved_extras         = $normalize_editor_repeater($meta_data['extra_price'] ?? array());
$saved_accom          = $normalize_editor_repeater($meta_data['_st_tours_accommodation'] ?? array());

foreach ($saved_itinerary as &$saved_itinerary_item) {
    if (is_object($saved_itinerary_item)) $saved_itinerary_item = (array) $saved_itinerary_item;
    if (!is_array($saved_itinerary_item)) {
        $saved_itinerary_item = array('title' => (string) $saved_itinerary_item, 'desc' => '', 'image' => '');
        continue;
    }
    $saved_itinerary_item['title'] = (string) ($saved_itinerary_item['title']
        ?? ($saved_itinerary_item['heading'] ?? ($saved_itinerary_item['day_title'] ?? ($saved_itinerary_item['name'] ?? ''))));
    $saved_itinerary_item['desc'] = (string) ($saved_itinerary_item['desc']
        ?? ($saved_itinerary_item['description'] ?? ($saved_itinerary_item['content'] ?? ($saved_itinerary_item['details'] ?? ''))));
    $saved_itinerary_image = $saved_itinerary_item['image']
        ?? ($saved_itinerary_item['image_id'] ?? ($saved_itinerary_item['image_url'] ?? ($saved_itinerary_item['thumbnail'] ?? '')));
    $saved_itinerary_item['image'] = is_numeric($saved_itinerary_image)
        ? (string) wp_get_attachment_url(absint($saved_itinerary_image))
        : (string) $saved_itinerary_image;
}
unset($saved_itinerary_item);

foreach ($saved_accom as &$saved_accom_item) {
    if (is_object($saved_accom_item)) $saved_accom_item = (array) $saved_accom_item;
    if (!is_array($saved_accom_item)) {
        $saved_accom_item = array('title' => (string) $saved_accom_item);
    }
    $saved_accom_item['title'] = (string) ($saved_accom_item['title'] ?? ($saved_accom_item['name'] ?? ($saved_accom_item['hotel_name'] ?? '')));
    $saved_accom_item['location'] = (string) ($saved_accom_item['location'] ?? ($saved_accom_item['address'] ?? ($saved_accom_item['city'] ?? '')));
    $saved_accom_item['type'] = (string) ($saved_accom_item['type'] ?? ($saved_accom_item['property_type'] ?? ''));
    $saved_accom_item['desc'] = (string) ($saved_accom_item['desc'] ?? ($saved_accom_item['description'] ?? ($saved_accom_item['details'] ?? '')));
    if (!isset($saved_accom_item['amenities']) && isset($saved_accom_item['facilities'])) {
        $saved_accom_item['amenities'] = $saved_accom_item['facilities'];
    }
    if (!isset($saved_accom_item['gallery'])) {
        $saved_accom_item['gallery'] = $saved_accom_item['gallery_images']
            ?? ($saved_accom_item['images'] ?? ($saved_accom_item['image'] ?? ($saved_accom_item['image_url'] ?? '')));
    }
    if (isset($saved_accom_item['amenities']) && is_array($saved_accom_item['amenities'])) {
        $saved_accom_item['amenities'] = implode(', ', array_filter(array_map('strval', $saved_accom_item['amenities'])));
    }
    if (isset($saved_accom_item['gallery']) && is_array($saved_accom_item['gallery'])) {
        $saved_accom_item['gallery'] = implode(',', array_filter(array_map('absint', $saved_accom_item['gallery'])));
    }
    $saved_accom_item['gallery_urls'] = array();
    foreach (array_filter(array_map('absint', explode(',', (string) ($saved_accom_item['gallery'] ?? '')))) as $saved_accom_image_id) {
        $saved_accom_image_url = wp_get_attachment_image_url($saved_accom_image_id, 'thumbnail');
        if ($saved_accom_image_url) $saved_accom_item['gallery_urls'][] = $saved_accom_image_url;
    }
}
unset($saved_accom_item);

$tripanza_display_sections = function_exists('tripanza_get_display_sections') ? tripanza_get_display_sections() : array();

// Tab state for Create/Edit vs Published Tours manager
$active_tab = isset($_GET['tab']) ? sanitize_key($_GET['tab']) : 'create';
if (!in_array($active_tab, array('create', 'manage'), true)) {
    $active_tab = 'create';
}
if ($is_edit && !isset($_GET['tab'])) {
    $active_tab = 'create';
}

$published_tours_query = null;
$page_base_url = '/add-your-own-trip';

if ($active_tab === 'manage') {
    $tours_query_args = array(
        'post_type'      => 'st_tours',
        // Administrators manage every author and every workflow state here.
        'post_status'    => array('publish', 'pending', 'draft'),
        'posts_per_page' => $is_admin_user ? -1 : 100,
        'orderby'        => 'modified',
        'order'          => 'DESC',
    );

    if (!current_user_can('manage_options')) {
        $tours_query_args['author'] = $current_user_id;
    }

    $published_tours_query = new WP_Query($tours_query_args);
}

?>
<script>window.TRIPANZA_STUDIO_NONCE = <?php echo wp_json_encode(wp_create_nonce('tripanza_original_studio_tools')); ?>;</script>

<!-- Use the matching workspace menu for the current role. -->
<!-- Host navigation is provided by the parent Next.js page. -->

<?php
// This standalone dashboard does not call the theme header.
wp_print_styles(array('wp-jquery-ui-dialog', 'jquery-ui-style'));
?>

<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" integrity="sha512-iecdLmaskl7CVkqkXNQ/ZH/XLlvWZOJyj7Yy7tcenmpD1ypASozpmT/E0iPtmFIB46ZmdtAc9eNBvH0H/ZpiBw==" crossorigin="anonymous" referrerpolicy="no-referrer" />
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<style>
    :root {
        --tp-bg: #f0f4f8;
        --tp-surface: #ffffff;
        --tp-surface-soft: #f8fafc;
        --tp-border: #e2e8f0;
        --tp-text: #0f172a;
        --tp-muted: #64748b;
        --tp-primary: #2563eb;
        --tp-primary-dark: #1d4ed8;
        --tp-primary-soft: #eff6ff;
        --tp-success: #059669;
        --tp-success-soft: #ecfdf5;
        --tp-warning: #d97706;
        --tp-warning-soft: #fffbeb;
        --tp-danger: #dc2626;
        --tp-danger-soft: #fef2f2;
        --tp-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
        --tp-shadow-sm: 0 4px 14px rgba(15, 23, 42, 0.06);
        --tp-radius: 16px;
        --tp-radius-sm: 10px;
        --tp-accent-itin: #2563eb;
        --tp-accent-avail: #059669;
        --tp-accent-faq: #d97706;
        --tp-accent-extra: #7c3aed;
        --tp-accent-accom: #0891b2;
    }

    .tripanza-tour-page {
        min-height: 100vh;
        background:
            radial-gradient(circle at top left, rgba(37, 99, 235, 0.08), transparent 28%),
            radial-gradient(circle at top right, rgba(14, 165, 233, 0.08), transparent 24%),
            var(--tp-bg);
        color: var(--tp-text);
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .tripanza-tour-dashboard {
        max-width: 1180px;
        margin: 0 auto;
        padding: 32px 20px 48px;
        box-sizing: border-box;
    }

    .tripanza-tour-dashboard * { box-sizing: border-box; }

    .tp-dashboard-hero { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 24px; flex-wrap: wrap; }
    .tp-dashboard-hero__content { flex: 1; min-width: 260px; }
    .tp-dashboard-badge {
        display: inline-flex; align-items: center; gap: 8px; padding: 7px 12px; border-radius: 999px;
        background: rgba(37, 99, 235, 0.1); color: var(--tp-primary-dark); font-size: 12px; font-weight: 700;
        letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 14px;
    }
    .tp-dashboard-title { margin: 0 0 10px; font-size: clamp(28px, 4vw, 36px); line-height: 1.15; font-weight: 800; color: var(--tp-text); }
    .tp-dashboard-subtitle { margin: 0; max-width: 720px; color: var(--tp-muted); font-size: 15px; line-height: 1.6; }

    .tp-dashboard-tabs {
        display: inline-flex; gap: 8px; padding: 6px; margin-bottom: 24px;
        background: rgba(255, 255, 255, 0.75); border: 1px solid var(--tp-border); border-radius: 14px;
        box-shadow: var(--tp-shadow-sm); flex-wrap: wrap;
    }
    .tp-dashboard-tab {
        border: none; background: transparent; color: var(--tp-muted); padding: 12px 18px; border-radius: 10px;
        font-size: 14px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;
        transition: all 0.2s ease; text-decoration: none;
    }
    .tp-dashboard-tab:hover { background: #f8fafc; color: var(--tp-text); }
    .tp-dashboard-tab.is-active {
        background: linear-gradient(135deg, var(--tp-primary) 0%, #1d4ed8 100%);
        color: #fff; box-shadow: 0 8px 18px rgba(37, 99, 235, 0.22);
    }

    .tp-panel {
        background: var(--tp-surface); border: 1px solid var(--tp-border); border-radius: var(--tp-radius);
        box-shadow: var(--tp-shadow); overflow: hidden;
    }
    .tp-panel__header {
        display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 22px 24px;
        border-bottom: 1px solid var(--tp-border); background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); flex-wrap: wrap;
    }
    .tp-panel__header h2 { margin: 0; font-size: 18px; font-weight: 700; }
    .tp-panel__header p { margin: 4px 0 0; font-size: 13px; color: var(--tp-muted); }
    .tp-panel__body { padding: 24px; }

    .ftc-back-link {
        display: inline-flex; align-items: center; gap: 6px; margin: -8px 0 20px; font-size: 13px;
        font-weight: 700; color: var(--tp-primary-dark); text-decoration: none;
    }
    .ftc-back-link:hover { text-decoration: underline; }

    .ftc-section {
        margin-bottom: 28px; padding: 22px; background: var(--tp-surface-soft);
        border: 1px solid var(--tp-border); border-radius: 14px;
    }
    .ftc-section:last-child { margin-bottom: 0; }
    .ftc-section-title {
        display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 700;
        color: #334155; margin-bottom: 18px; padding-bottom: 10px; border-bottom: 1px solid var(--tp-border);
    }
    .ftc-section-title i { color: var(--tp-primary); font-size: 15px; }

    .ftc-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    .ftc-grid.three-cols { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .ftc-form-group { display: flex; flex-direction: column; margin-bottom: 0; min-width: 0; }
    .ftc-form-group.full-width { grid-column: 1 / -1; }
    .ftc-form-group label { font-size: 13px; font-weight: 700; margin-bottom: 8px; color: #334155; }
    .ftc-form-group input[type="text"],
    .ftc-form-group input[type="number"],
    .ftc-form-group input[type="email"],
    .ftc-form-group input[type="date"],
    .ftc-form-group select,
    .ftc-form-group textarea {
        width: 100%; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: var(--tp-radius-sm);
        font-size: 14px; background: #fff; color: var(--tp-text); font-family: inherit;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .ftc-form-group input:focus,
    .ftc-form-group select:focus,
    .ftc-form-group textarea:focus {
        outline: none; border-color: var(--tp-primary); box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
    }

    .checkbox-cluster {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;
        background: #fff; padding: 14px; border: 1px solid var(--tp-border); border-radius: var(--tp-radius-sm);
        margin-bottom: 18px;
    }
    .checkbox-item { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: #334155; }
    .checkbox-item input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--tp-primary); }

    .ftc-category-grid {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px;
        background: #fff; padding: 16px; border: 1px dashed #cbd5e1; border-radius: var(--tp-radius-sm);
        max-height: 220px; overflow-y: auto;
    }
    .ftc-field-hint { font-size: 12px; font-weight: 600; margin-bottom: 10px; color: var(--tp-muted); }
    .ftc-field-note { font-size: 12px; color: var(--tp-muted); line-height: 1.5; margin-top: 6px; }

    .itinerary-day-box, .avail-date-box, .faq-row-box, .extra-row-box, .accommodation-block {
        position: relative; background: #fff; border: 1px solid var(--tp-border); padding: 20px;
        margin-bottom: 16px; border-radius: 14px; box-shadow: var(--tp-shadow-sm);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .itinerary-day-box:hover, .avail-date-box:hover, .faq-row-box:hover, .extra-row-box:hover, .accommodation-block:hover {
        box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
    }
    .itinerary-day-box { border-left: 4px solid var(--tp-accent-itin); }
    .avail-date-box { border-left: 4px solid var(--tp-accent-avail); }
    .faq-row-box { border-left: 4px solid var(--tp-accent-faq); }
    .extra-row-box { border-left: 4px solid var(--tp-accent-extra); }
    .accommodation-block { border-left: 4px solid var(--tp-accent-accom); }

    .ftc-day-label {
        font-size: 14px; font-weight: 700; margin-bottom: 12px; color: var(--tp-primary-dark);
        display: flex; align-items: center; gap: 8px;
    }

    .remove-row-btn, .remove-accommodation {
        position: absolute; top: 14px; right: 14px; display: inline-flex; align-items: center; gap: 6px;
        padding: 6px 12px; border: 1px solid #fecaca; border-radius: 8px; background: var(--tp-danger-soft);
        color: var(--tp-danger); font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s ease;
    }
    .remove-row-btn:hover, .remove-accommodation:hover { background: var(--tp-danger); color: #fff; border-color: var(--tp-danger); }

    .add-row-btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        background: var(--tp-success); color: #fff; border: none; padding: 10px 18px; border-radius: var(--tp-radius-sm);
        font-weight: 700; cursor: pointer; margin-top: 10px; font-size: 13px; transition: all 0.2s ease;
    }
    .add-row-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(5, 150, 105, 0.25); }
    .add-row-btn.blue-btn { background: linear-gradient(135deg, var(--tp-primary) 0%, #1d4ed8 100%); }
    .add-row-btn.green-btn { background: linear-gradient(135deg, var(--tp-success) 0%, #047857 100%); }

    .media-preview-img {
        width: 140px; height: 90px; margin: 0; border: 1px solid var(--tp-border);
        border-radius: var(--tp-radius-sm); display: block; object-fit: cover;
    }
    .media-preview-item { position: relative; display: inline-block; margin-top: 10px; line-height: 0; }
    .media-preview-remove {
        position: absolute; z-index: 2; top: -7px; right: -7px; width: 25px; height: 25px;
        display: inline-flex; align-items: center; justify-content: center; padding: 0;
        border: 2px solid #fff; border-radius: 50%; background: #111827; color: #fff;
        box-shadow: 0 4px 12px rgba(15, 23, 42, .28); font: 700 18px/1 Arial, sans-serif;
        cursor: pointer; transition: transform .18s ease, background .18s ease;
    }
    .media-preview-remove:hover { background: var(--tp-danger); transform: scale(1.08); }
    .media-uploader-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .media-uploader-row input { flex: 1; min-width: 160px; }
    .upload-trigger-btn {
        background: #fff; color: #334155; border: 1px solid #cbd5e1; padding: 10px 16px;
        border-radius: var(--tp-radius-sm); cursor: pointer; font-size: 13px; font-weight: 700; transition: all 0.2s ease;
    }
    .upload-trigger-btn:hover { background: var(--tp-primary-soft); border-color: #93c5fd; color: var(--tp-primary-dark); }
    .media-option {
        display: inline-flex; align-items: center; gap: 9px; margin: 10px 0 2px; padding: 10px 13px;
        border: 1px solid #dbe3f0; border-radius: 12px; background: #f8fafc; color: #334155;
        font-size: 13px; font-weight: 700; cursor: pointer;
    }
    .media-option input { width: 17px; height: 17px; accent-color: var(--tp-primary); }
    .ftc-optional-note { margin: -4px 0 14px; color: #64748b; font-size: 13px; }
    .tp-launch-offer {
        display:flex; align-items:flex-start; gap:12px; margin:0 0 18px; padding:15px 16px;
        border:1px solid #d8ee77; border-radius:16px; background:linear-gradient(135deg,#f7ffd8,#fff);
        color:#172033;
    }
    .tp-launch-offer__icon { display:grid; place-items:center; flex:0 0 34px; height:34px; border-radius:11px; background:#cdec58; font-size:17px; }
    .tp-launch-offer strong { display:block; margin-bottom:3px; font-size:14px; }
    .tp-launch-offer p { margin:0; color:#526077; font-size:12px; line-height:1.5; }
    .tp-host-commission-box { margin:0 0 18px; padding:16px; border:1px solid #dbe3f0; border-radius:16px; background:#f8faff; }
    .tp-host-commission-box__head { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; }
    .tp-host-commission-box__copy { max-width:680px; }
    .tp-host-commission-box__copy strong { display:block; color:#172033; font-size:14px; }
    .tp-host-commission-box__copy p { margin:5px 0 0; color:#64748b; font-size:12px; line-height:1.55; }
    .tp-host-commission-box__field { flex:0 0 220px; }
    .tp-host-commission-box__field label { display:block; margin-bottom:6px; color:#334155; font-size:11px; font-weight:800; }
    .tp-host-commission-box__field input { margin:0; }
    .tp-inline-payout { margin-top:8px; padding:10px; border:1px solid #e2e8f0; border-radius:11px; background:#f8fafc; color:#64748b; font-size:10px; font-weight:700; line-height:1.45; }
    .tp-inline-payout span { display:flex; justify-content:space-between; gap:8px; }
    .tp-inline-payout [hidden] { display:none !important; }
    .tp-inline-payout span + span { margin-top:4px; }
    .tp-inline-payout b { color:#172033; font-size:11px; white-space:nowrap; }
    .tp-inline-payout .is-owner-total { margin-top:7px; padding-top:7px; border-top:1px dashed #cbd5e1; color:#172033; }
    .tp-inline-payout .is-owner-total b { color:#2452d6; font-size:12px; }

    .ftc-btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%;
        margin-top: 24px; padding: 14px 20px; border: none; border-radius: var(--tp-radius-sm);
        background: linear-gradient(135deg, var(--tp-primary) 0%, #1d4ed8 100%);
        color: #fff; font-size: 15px; font-weight: 700; cursor: pointer;
        box-shadow: 0 8px 20px rgba(37, 99, 235, 0.25); transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .ftc-btn:hover { transform: translateY(-1px); box-shadow: 0 12px 24px rgba(37, 99, 235, 0.3); }

    .ftc-alert {
        display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-radius: var(--tp-radius-sm);
        margin-bottom: 20px; font-weight: 600; font-size: 14px;
    }
    .ftc-success { background: var(--tp-success-soft); color: #065f46; border: 1px solid #a7f3d0; }
    .ftc-error { background: var(--tp-danger-soft); color: #991b1b; border: 1px solid #fecaca; }
    .ftc-readonly-notice {
        display:flex; align-items:flex-start; gap:12px; margin-bottom:20px; padding:16px 18px;
        border:1px solid #fde68a; border-radius:14px; background:#fffbeb; color:#854d0e;
        font-size:13px; font-weight:650; line-height:1.55;
    }
    .ftc-readonly-notice i { margin-top:3px; color:#d97706; }
    .ftc-readonly-notice strong { display:block; margin-bottom:2px; color:#713f12; }
    .ftc-readonly-fieldset { min-width:0; margin:0; padding:0; border:0; }
    .ftc-readonly-fieldset:disabled { opacity:1; }
    .ftc-readonly-fieldset:disabled input,
    .ftc-readonly-fieldset:disabled select,
    .ftc-readonly-fieldset:disabled textarea {
        color:#475569; background:#f1f5f9; border-color:#d7dee8; cursor:not-allowed;
        -webkit-text-fill-color:#475569; opacity:1;
    }
    .ftc-readonly-fieldset:disabled button { cursor:not-allowed; opacity:.55; }

    .ftc-tours-toolbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; margin-bottom: 20px; }
    .ftc-tours-toolbar .ftc-form-group { margin-bottom: 0; flex: 1; min-width: 220px; }
    .ftc-tours-toolbar .ftc-form-group.ftc-form-group--compact { flex: 0 1 240px; min-width: 200px; }
    .ftc-poster-filter { width: 100%; }
    .ftc-filter-btn {
        background: linear-gradient(135deg, var(--tp-primary) 0%, #1d4ed8 100%); color: #fff; border: none;
        padding: 12px 18px; border-radius: var(--tp-radius-sm); font-size: 14px; font-weight: 700;
        cursor: pointer; white-space: nowrap; transition: all 0.2s ease;
    }
    .ftc-filter-btn.secondary { background: #fff; color: #334155; border: 1px solid #cbd5e1; }
    .ftc-filter-btn:hover { transform: translateY(-1px); }

    .ftc-tours-table-wrap { overflow-x: auto; border: 1px solid var(--tp-border); border-radius: 14px; background: #fff; }
    .ftc-tours-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .ftc-tours-table th, .ftc-tours-table td { padding: 14px 16px; text-align: left; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    .ftc-tours-table th {
        background: #f8fafc; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
        color: var(--tp-muted); font-weight: 700;
    }
    .ftc-tours-table tbody tr { transition: background 0.15s ease; }
    .ftc-tours-table tbody tr:hover td { background: #f8fafc; }
    .ftc-tours-table tr:last-child td { border-bottom: none; }
    .ftc-tour-title-cell { font-weight: 700; color: var(--tp-text); }
    .ftc-tour-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .ftc-action-link {
        display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 8px;
        font-family: inherit; font-size: 12px; font-weight: 700; text-decoration: none; transition: all 0.2s ease;
        cursor: pointer;
    }
    .ftc-action-link.edit { background: var(--tp-primary-soft); color: var(--tp-primary-dark); border: 1px solid #bfdbfe; }
    .ftc-action-link.view { background: var(--tp-success-soft); color: #047857; border: 1px solid #a7f3d0; }
    .ftc-action-link.unpublish { background: var(--tp-danger-soft); color: #b42318; border: 1px solid #fecaca; }
    .ftc-action-link:hover { transform: translateY(-1px); }
    .ftc-action-form { display: inline-flex; margin: 0; }
    .ftc-status-pill { display: inline-flex; padding: 6px 9px; border-radius: 999px; background: #eef2ff; color: var(--tp-primary); font-size: 9px; font-weight: 900; letter-spacing: .6px; text-transform: uppercase; }
    .ftc-status-pill.is-publish { background: #effbd6; color: #58700d; }
    .ftc-status-pill.is-pending { background: #fff5d9; color: #946600; }
    .ftc-empty-state {
        padding: 40px 24px; text-align: center; color: var(--tp-muted); background: linear-gradient(180deg, #fff, #f8fafc);
        border: 2px dashed #cbd5e1; border-radius: 14px;
    }
    .ftc-tours-count { margin-top: 14px; font-size: 13px; color: var(--tp-muted); font-weight: 600; }

    .ftc-bulk-tools {
        background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%); padding: 18px 20px;
        border: 1px dashed #6ee7b7; margin-bottom: 20px; border-radius: 14px;
    }
    .ftc-bulk-tools__title {
        font-size: 13px; font-weight: 700; color: #047857; margin-bottom: 14px;
        display: flex; align-items: center; gap: 8px;
    }
    .ftc-bulk-tools__row { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-end; }
    .ftc-bulk-tools__field { display: flex; flex-direction: column; gap: 6px; }
    .ftc-bulk-tools__field label { font-size: 11px; font-weight: 700; color: var(--tp-muted); }
    .ftc-bulk-tools__field input {
        padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; width: 120px; font-size: 13px;
    }
    .ftc-bulk-tools__apply {
        background: linear-gradient(135deg, var(--tp-success) 0%, #047857 100%); color: #fff; border: none;
        padding: 10px 16px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 12px;
    }
    .ftc-bulk-sync {
        display: flex; align-items: center; gap: 8px; margin-left: auto; font-size: 13px; font-weight: 600;
        color: #334155; background: #fff; padding: 10px 14px; border-radius: 8px; border: 1px solid #a7f3d0; cursor: pointer;
    }
    .ftc-bulk-sync input { accent-color: var(--tp-success); }

    .tripanza-settings-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; margin-top: 10px; }
    .tripanza-settings-item {
        display: flex; align-items: center; gap: 8px; padding: 12px 14px; background: #fff;
        border: 1px solid var(--tp-border); border-radius: var(--tp-radius-sm); font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .tripanza-settings-item input[type="checkbox"] { accent-color: var(--tp-primary); }
    .tripanza-settings-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; padding-top: 16px; border-top: 1px dashed var(--tp-border); }
    .tripanza-settings-btn {
        background: #fff; color: #334155; border: 1px solid #cbd5e1; padding: 10px 14px;
        border-radius: var(--tp-radius-sm); cursor: pointer; font-size: 13px; font-weight: 700;
    }
    .tripanza-settings-btn:hover { background: #f8fafc; }
    .tripanza-settings-note { font-size: 13px; color: var(--tp-muted); line-height: 1.5; margin: 0 0 14px; }

    .avail-date-row-grid { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; gap: 14px; align-items: flex-end; padding-right: 90px; }
    .avail-date-row-grid .ftc-form-group { margin-bottom: 0; }

    .ftc-amenity-grid {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px;
        background: #fff; padding: 12px; border: 1px dashed #cbd5e1; max-height: 160px; overflow-y: auto; border-radius: var(--tp-radius-sm);
    }
    .ftc-amenity-grid label { font-size: 12px; display: flex; align-items: center; gap: 6px; }

    .ui-datepicker {
        z-index: 99999 !important; font-family: inherit; font-size: 13px; border: 1px solid var(--tp-border);
        background: #fff; border-radius: 12px; box-shadow: var(--tp-shadow); padding: 10px;
    }
    .ui-datepicker-header { background: linear-gradient(135deg, var(--tp-primary) 0%, #1d4ed8 100%) !important; border: none !important; color: #fff !important; font-weight: 700; border-radius: 8px; padding: 8px 0; }
    .ui-datepicker-title select { color: #333 !important; margin: 0 2px; font-size: 12px; }
    .ui-datepicker th { font-weight: 700; color: var(--tp-muted); padding: 6px 0; }
    .ui-datepicker td span, .ui-datepicker td a { text-align: center; border-radius: 6px; padding: 6px; color: #333; text-decoration: none; }
    .ui-datepicker-calendar .ui-state-default { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; }
    .ui-datepicker-calendar .ui-state-hover { background: var(--tp-primary) !important; color: #fff !important; }
    .ui-datepicker-calendar .ui-state-active { background: var(--tp-success) !important; color: #fff !important; border-color: var(--tp-success) !important; }

    /* AI Assistant Card */
    .ai-assistant-card {
        background: linear-gradient(135deg, #eff6ff 0%, #f0f9ff 50%, #faf5ff 100%);
        border: 1px solid #bfdbfe; border-radius: 18px; padding: 22px; margin-bottom: 24px;
        box-shadow: var(--tp-shadow-sm); position: relative; overflow: hidden; transition: all 0.3s ease;
    }
    .ai-assistant-card:focus-within { border-color: #93c5fd; box-shadow: 0 12px 28px rgba(37, 99, 235, 0.12); transform: translateY(-2px); }
    .ai-assistant-card:has(#ai_generate_btn:disabled) {
        background: linear-gradient(135deg, rgba(37, 99, 235, 0.06), rgba(14, 165, 233, 0.06)), #fff;
        animation: cardBreath 3s infinite ease-in-out;
    }
    .ai-assistant-card:has(#ai_generate_btn:disabled)::after {
        content: ''; position: absolute; bottom: 0; left: 0; width: 100%; height: 4px;
        background: linear-gradient(90deg, #2563eb, #38bdf8, #7c3aed, #2563eb); background-size: 300% 100%;
        animation: geminiFlow 2s infinite linear;
    }
    .ai-assistant-card:has(#ai_generate_btn:disabled) #ai_raw_text { opacity: 0.55; pointer-events: none; }
    .ai-assistant-card:has(#ai_generate_btn:disabled) #ai_status {
        display: flex !important; align-items: center; background: var(--tp-primary-soft);
        border-left: 3px solid var(--tp-primary); color: var(--tp-primary-dark);
    }
    .ai-assistant-title {
        font-size: 17px; font-weight: 700; color: var(--tp-text); margin-bottom: 8px;
        display: flex; align-items: center; gap: 8px;
    }
    .ai-assistant-title span.sparkle {
        background: linear-gradient(135deg, #2563eb, #38bdf8, #7c3aed);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 1.2rem;
    }
    .ai-assistant-desc { font-size: 14px; color: var(--tp-muted); margin-bottom: 16px; line-height: 1.55; }
    .ai-assistant-input {
        width: 100%; padding: 14px 16px; border: 1px solid #cbd5e1; background: #fff;
        border-radius: 12px; font-size: 14px; margin-bottom: 12px; resize: none; font-family: inherit;
        transition: all 0.2s ease;
    }
    .ai-assistant-input:focus { outline: none; border-color: var(--tp-primary); box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12); }
    .ai-assistant-btn {
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #fff; border: none;
        padding: 12px 22px; border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer;
        box-shadow: 0 8px 18px rgba(37, 99, 235, 0.25); transition: all 0.2s ease;
    }
    .ai-assistant-btn:hover { transform: translateY(-1px); box-shadow: 0 12px 24px rgba(37, 99, 235, 0.3); }
    .ai-assistant-btn:disabled { background: #e2e8f0 !important; color: #94a3b8 !important; box-shadow: none !important; cursor: not-allowed; transform: none !important; }
    .ai-status-msg {
        margin-top: 14px; font-size: 13px; font-weight: 600; padding: 12px 14px; background: #fff;
        border-radius: 10px; border-left: 3px solid #e2e8f0; display: none;
    }

    @keyframes geminiFlow { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
    @keyframes cardBreath { 0%, 100% { transform: translateY(-2px); } 50% { transform: translateY(-4px); } }

    @media (max-width: 900px) {
        .ftc-grid, .ftc-grid.three-cols { grid-template-columns: 1fr; }
        .avail-date-row-grid { grid-template-columns: 1fr; padding-right: 0; margin-top: 12px; }
        .ftc-bulk-tools__row { flex-direction: column; align-items: stretch; }
        .ftc-bulk-sync { margin-left: 0; }
        .tp-host-commission-box__head { flex-direction:column; }
        .tp-host-commission-box__field { flex-basis:auto; width:100%; }
    }
    @media (max-width: 768px) {
        .tripanza-tour-dashboard { padding: 20px 14px 36px; }
        .tp-panel__body { padding: 18px; }
        .ftc-section { padding: 16px; }
        /* iOS Safari zooms focused controls whose computed text size is below 16px. */
        .tripanza-tour-page input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),
        .tripanza-tour-page select,
        .tripanza-tour-page textarea {
            font-size: 16px !important;
            touch-action: manipulation;
        }
    }

    /* Tripanza Youth Host Studio */
    html, body { max-width: 100%; margin: 0; overflow-x: hidden; }
    body { background: #f7f8fc; }
    .tripanza-tour-page {
        --tp-primary: #3157d5;
        --tp-primary-dark: #2748ba;
        --tp-primary-soft: #eef2ff;
        --tp-lime: #cfe95c;
        --tp-text: #151925;
        --tp-muted: #6f788b;
        --tp-border: #dce3ee;
        background: radial-gradient(circle at 96% 0, rgba(207,233,92,.42), transparent 22%), #f7f8fc;
    }
    .tp-studio-topbar {
        display: flex; width: min(calc(100% - 40px), 1180px); height: 72px; margin: 0 auto;
        align-items: center; justify-content: space-between;
    }
    .tp-studio-brand { display: inline-flex; margin-left:auto; align-items: center; gap: 9px; color:var(--tp-text); font-size: 18px; font-weight: 950; letter-spacing: -.4px; text-decoration:none; }
    .tp-studio-brand__mark { display: grid; width: 31px; height: 31px; place-items: center; border-radius: 50%; background: var(--tp-primary); color: #fff; font-size: 16px; }
    .tripanza-tour-dashboard { padding-top: 24px; padding-bottom: 110px; }
    .tp-dashboard-hero {
        position: relative; min-height: 228px; padding: 42px; align-items: center; overflow: hidden;
        border-radius: 30px; background: var(--tp-primary); color: #fff; box-shadow: 0 24px 60px rgba(49,87,213,.21);
    }
    .tp-dashboard-hero::before { position: absolute; right: -78px; bottom: -145px; width: 330px; height: 330px; border: 42px solid rgba(255,255,255,.12); border-radius: 50%; content: ""; }
    .tp-dashboard-hero::after { position: absolute; top: 0; left: 0; width: 145px; height: 5px; background: var(--tp-lime); content: ""; }
    .tp-dashboard-hero__content { position: relative; z-index: 1; }
    .tp-dashboard-badge { margin-bottom: 16px; padding: 7px 12px; background: rgba(255,255,255,.13); color: var(--tp-lime); font-size: 10px; font-weight: 900; letter-spacing: 1.6px; }
    .tp-dashboard-title { max-width: 670px; color: #fff; font-size: clamp(39px, 6vw, 68px); line-height: .94; letter-spacing: -3px; }
    .tp-dashboard-title em { color: var(--tp-lime); font-style: normal; }
    .tp-dashboard-subtitle { max-width: 620px; color: rgba(255,255,255,.78); font-size: 14px; }
    .tp-dashboard-tabs { display: flex; width: 100%; margin: -22px 0 25px; padding: 7px; position: relative; z-index: 2; border-radius: 19px; background: #fff; }
    .tp-dashboard-tab { flex: 1; justify-content: center; min-height: 46px; border-radius: 13px; font-size: 12px; }
    .tp-dashboard-tab.is-active { background: var(--tp-lime); color: var(--tp-text); box-shadow: none; }
    .tp-panel { border-radius: 25px; box-shadow: 0 18px 55px rgba(20,27,48,.07); }
    .tp-panel__header { padding: 25px 28px; background: #fff; }
    .tp-panel__header h2 { font-size: 22px; font-weight: 950; letter-spacing: -.6px; }
    .tp-panel__body { padding: 28px; }
    .tp-builder-map { display: grid; grid-template-columns: repeat(3,1fr); gap: 9px; margin-bottom: 24px; }
    .tp-builder-map span { padding: 13px 14px; border-radius: 14px; background: #f2f5fb; color: var(--tp-muted); font-size: 10px; font-weight: 850; }
    .tp-builder-map b { display: block; margin-bottom: 3px; color: var(--tp-primary); font-size: 9px; letter-spacing: 1px; }
    .ftc-section { padding: 24px; border-radius: 20px; background: #fff; box-shadow: 0 10px 35px rgba(24,31,53,.045); }
    .ftc-section-title { margin-bottom: 21px; color: var(--tp-text); font-size: 16px; font-weight: 950; }
    .ftc-section-title i { display: grid; width: 32px; height: 32px; place-items: center; border-radius: 10px; background: var(--tp-primary-soft); }
    .ftc-form-group label { color: #495367; font-size: 11px; font-weight: 850; }
    .ftc-form-group input[type="text"], .ftc-form-group input[type="number"], .ftc-form-group input[type="email"], .ftc-form-group input[type="date"], .ftc-form-group select, .ftc-form-group textarea {
        min-height: 49px; border-color: var(--tp-border); border-radius: 13px; background: #fbfcff; font-size: 14px;
    }
    .checkbox-cluster, .ftc-category-grid, .ftc-amenity-grid { border-style: solid; border-radius: 15px; background: #f8f9fd; }
    .itinerary-day-box, .avail-date-box, .faq-row-box, .extra-row-box, .accommodation-block { border-radius: 17px; box-shadow: none; }
    .add-row-btn { min-height: 43px; border-radius: 12px; background: var(--tp-primary); }
    .ai-assistant-card { padding: 26px; border: 0; border-radius: 22px; background: #151925; color: #fff; }
    .ai-assistant-card::before { position: absolute; right: -55px; top: -75px; width: 180px; height: 180px; border: 28px solid rgba(207,233,92,.15); border-radius: 50%; content: ""; }
    .ai-assistant-title { position: relative; color: #fff; font-size: 21px; font-weight: 950; }
    .ai-assistant-desc { position: relative; max-width: 760px; color: #aeb7c9; }
    .ai-assistant-btn { position: relative; background: var(--tp-lime); color: var(--tp-text); box-shadow: none; }
    .ftc-btn { position: sticky; z-index: 20; bottom: max(6px, env(safe-area-inset-bottom)); min-height: 64px; border-radius: 18px; background: var(--tp-lime); color: var(--tp-text); font-size: 15px; font-weight: 950; box-shadow: 0 16px 40px rgba(21,25,37,.24); }
    .ftc-btn::after { display: grid; width: 39px; height: 39px; margin-left: auto; place-items: center; border-radius: 12px; background: var(--tp-primary); color: #fff; content: "\2192"; font-size: 20px; }
    .ftc-btn:hover { box-shadow: 0 18px 44px rgba(21,25,37,.28); }

    @media (max-width: 768px) {
        .tp-studio-topbar { width: calc(100% - 28px); height: 62px; }
        .tripanza-tour-dashboard { padding: 10px 14px 90px; }
        .tp-dashboard-hero { min-height: 205px; padding: 31px 23px 43px; border-radius: 0 0 27px 27px; margin-inline: -14px; }
        .tp-dashboard-title { font-size: 43px; letter-spacing: -2.4px; }
        .tp-dashboard-subtitle { font-size: 12px; }
        .tp-dashboard-tabs { margin-top: -23px; }
        .tp-panel, .ftc-section { border-radius: 19px; }
        .tp-panel__header, .tp-panel__body { padding: 18px 15px; }
        .tp-builder-map { grid-template-columns: 1fr; gap: 7px; }
        .tp-builder-map span { padding: 10px 12px; }
        .ftc-section { padding: 16px 14px; }
        .itinerary-day-box, .avail-date-box, .faq-row-box, .extra-row-box, .accommodation-block { padding: 16px 12px; padding-top: 50px; }
        .remove-row-btn, .remove-accommodation { top: 10px; right: 10px; }
        .media-uploader-row { align-items: stretch; }
        .media-uploader-row input, .upload-trigger-btn { width: 100%; }
        .ftc-tours-table-wrap { border: 0; overflow: visible; }
        .ftc-tours-table thead { display: none; }
        .ftc-tours-table, .ftc-tours-table tbody, .ftc-tours-table tr, .ftc-tours-table td { display: block; width: 100%; }
        .ftc-tours-table tr { margin-bottom: 12px; padding: 14px; border: 1px solid var(--tp-border); border-radius: 16px; background: #fff; }
        .ftc-tours-table td { padding: 7px 0; border: 0; }
    }
</style>
 
<div class="tripanza-tour-page">
<header class="tp-studio-topbar">
    <a class="tp-studio-brand" href="<?php echo esc_url(home_url('/')); ?>" aria-label="Tripanza home">
        <span class="tp-studio-brand__mark">T</span><span>Tripanza</span>
    </a>
</header>
<div class="tripanza-tour-dashboard">

    <div class="tp-dashboard-hero">
        <div class="tp-dashboard-hero__content">
            <span class="tp-dashboard-badge"><i class="fas fa-route"></i> Tripanza Host Studio</span>
            <h1 class="tp-dashboard-title">Build the trip.<br><em>Set the vibe.</em></h1>
            <p class="tp-dashboard-subtitle">Turn your idea into a bookable group trip—story, stays, dates, pricing and every crew-ready detail in one place.</p>
        </div>
    </div>

    <nav class="tp-dashboard-tabs" aria-label="Tour manager tabs">
        <a href="<?php echo esc_url($page_base_url); ?>" class="tp-dashboard-tab <?php echo $active_tab === 'create' ? 'is-active' : ''; ?>">
            <i class="fas fa-plus-circle"></i> Trip Builder
        </a>
        <a href="<?php echo esc_url(add_query_arg('tab', 'manage', $page_base_url)); ?>" class="tp-dashboard-tab <?php echo $active_tab === 'manage' ? 'is-active' : ''; ?>">
            <i class="fas fa-list"></i> My Trips
        </a>
    </nav>

    <div class="tp-panel">
        <div class="tp-panel__header">
            <div>
                <?php if ($active_tab === 'manage') : ?>
        <h2><?php echo $is_admin_user ? 'All Tours' : 'Your Trips'; ?></h2>
                    <p><?php echo $is_admin_user ? 'Search and manage published, pending, and draft tours from every author.' : 'Track and update the trips your crew can book.'; ?></p>
                <?php else : ?>
                    <h2><?php echo $is_edit ? 'Tune your trip' : 'Create a new trip'; ?></h2>
                    <p>Build it section by section. Your work is saved as a draft when required media is still missing.</p>
                <?php endif; ?>
            </div>
        </div>
        <div class="tp-panel__body">
    <?php if ($active_tab === 'manage') : ?>

            <?php if ($success_message): ?>
                <div class="ftc-alert ftc-success"><i class="fas fa-check-circle"></i> <?php echo wp_kses_post($success_message); ?></div>
            <?php endif; ?>
            <?php if ($error_message): ?>
                <div class="ftc-alert ftc-error"><i class="fas fa-exclamation-circle"></i> <?php echo esc_html($error_message); ?></div>
            <?php endif; ?>

            <div class="ftc-tours-toolbar">
                <div class="ftc-form-group">
                    <label for="title_filter">Filter by Title</label>
                    <input type="text" id="title_filter" placeholder="Search tour title..." autocomplete="off">
                </div>
                <?php if (current_user_can('manage_options')) : ?>
                    <div class="ftc-form-group ftc-form-group--compact">
                        <label for="poster_filter">Filter by Posted By</label>
                        <select id="poster_filter" class="ftc-poster-filter">
                            <option value="all">All Tours</option>
                            <option value="admin">Admin Posted Tours</option>
                            <option value="host">Host / Partner Posted Tours</option>
                        </select>
                    </div>
                <?php endif; ?>
                <button type="button" id="title_filter_clear" class="ftc-filter-btn secondary" style="display:none;"><i class="fas fa-times"></i> Clear</button>
            </div>

            <?php if ($published_tours_query && $published_tours_query->have_posts()) : ?>
                <?php $published_tours_total = intval($published_tours_query->post_count); ?>
                <div class="ftc-tours-table-wrap" id="ftc-tours-table-wrap">
                    <table class="ftc-tours-table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <?php if (current_user_can('manage_options')) : ?>
                                    <th>Author</th>
                                <?php endif; ?>
                                <th>Status</th>
                                <th>Last Updated</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php while ($published_tours_query->have_posts()) : $published_tours_query->the_post(); ?>
                                <?php
                                $list_tour_id = get_the_ID();
                                $edit_url = add_query_arg('tour_id', $list_tour_id, $page_base_url);
                                $author_name = get_the_author();
                                $tour_title = get_the_title();
                                $tour_status = get_post_status($list_tour_id);
                                $author_user = get_userdata((int) get_the_author_meta('ID'));
                                $poster_type = ($author_user && (bool) array_intersect(array('partner', 'host'), (array) $author_user->roles)) ? 'host' : 'admin';
                                $list_is_read_only_copy = !$is_admin_user && absint(get_post_meta($list_tour_id, 'host_parent_trip_id', true));
                                ?>
                                <tr data-search-title="<?php echo esc_attr(strtolower($tour_title)); ?>" data-poster-type="<?php echo esc_attr($poster_type); ?>">
                                    <td class="ftc-tour-title-cell"><?php echo esc_html($tour_title); ?></td>
                                    <?php if (current_user_can('manage_options')) : ?>
                                        <td><?php echo esc_html($author_name); ?></td>
                                    <?php endif; ?>
                                    <td><span class="ftc-status-pill is-<?php echo esc_attr($tour_status); ?>"><?php echo esc_html($tour_status); ?></span></td>
                                    <td><?php echo esc_html(get_the_modified_date('M j, Y')); ?></td>
                                    <td>
                                        <div class="ftc-tour-actions">
                                            <a href="<?php echo esc_url($edit_url); ?>" class="ftc-action-link edit"><i class="fas fa-<?php echo $list_is_read_only_copy ? 'lock' : 'edit'; ?>"></i> <?php echo $list_is_read_only_copy ? 'View read-only' : 'Edit'; ?></a>
                                            <?php if ('publish' === $tour_status) : ?>
                                                <a href="<?php echo esc_url(get_permalink($list_tour_id)); ?>" class="ftc-action-link view" target="_blank" rel="noopener"><i class="fas fa-external-link-alt"></i> View Live</a>
                                                <?php if ($is_admin_user) : ?>
                                                    <form method="post" action="<?php echo esc_url(add_query_arg('tab', 'manage', $page_base_url)); ?>" class="ftc-action-form" onsubmit="return confirm('Unpublish this trip? It will be moved to draft and removed from the live site.');">
                                                        <?php wp_nonce_field('tripanza_unpublish_tour_' . $list_tour_id, 'tripanza_admin_tour_nonce'); ?>
                                                        <input type="hidden" name="tripanza_admin_tour_action" value="unpublish">
                                                        <input type="hidden" name="admin_tour_id" value="<?php echo esc_attr($list_tour_id); ?>">
                                                        <button type="submit" class="ftc-action-link unpublish"><i class="fas fa-eye-slash"></i> Unpublish</button>
                                                    </form>
                                                <?php endif; ?>
                                            <?php endif; ?>
                                        </div>
                                    </td>
                                </tr>
                            <?php endwhile; ?>
                        </tbody>
                    </table>
                </div>
                <p id="ftc-tours-count" class="ftc-tours-count" data-total="<?php echo esc_attr($published_tours_total); ?>">
                    Showing <?php echo esc_html($published_tours_total); ?> trip<?php echo $published_tours_total === 1 ? '' : 's'; ?>.
                </p>
                <div id="ftc-tours-no-match" class="ftc-empty-state" style="display:none;"></div>
            <?php else : ?>
                <div class="ftc-empty-state">
                    No trips found<?php echo $is_admin_user ? '.' : ' for your host account yet.'; ?>
                </div>
            <?php endif; ?>
            <?php wp_reset_postdata(); ?>

        <script>
        document.addEventListener('DOMContentLoaded', function () {
            var searchInput = document.getElementById('title_filter');
            var posterFilter = document.getElementById('poster_filter');
            var clearBtn = document.getElementById('title_filter_clear');
            var tableWrap = document.getElementById('ftc-tours-table-wrap');
            var countEl = document.getElementById('ftc-tours-count');
            var noMatchEl = document.getElementById('ftc-tours-no-match');

            if (!searchInput || !tableWrap) {
                return;
            }

            var rows = tableWrap.querySelectorAll('tbody tr[data-search-title]');
            var totalTours = countEl ? parseInt(countEl.getAttribute('data-total'), 10) : rows.length;

            function getPosterFilterLabel(value) {
                if (value === 'admin') {
                    return 'admin posted tours';
                }
                if (value === 'host') {
                    return 'host / partner posted tours';
                }
                return '';
            }

            function updateTourFilter() {
                var query = searchInput.value.trim().toLowerCase();
                var posterType = posterFilter ? posterFilter.value : 'all';
                var visibleCount = 0;

                rows.forEach(function (row) {
                    var title = row.getAttribute('data-search-title') || '';
                    var rowPoster = row.getAttribute('data-poster-type') || 'admin';
                    var matchesTitle = query === '' || title.indexOf(query) !== -1;
                    var matchesPoster = posterType === 'all' || rowPoster === posterType;
                    var matches = matchesTitle && matchesPoster;
                    row.style.display = matches ? '' : 'none';
                    if (matches) {
                        visibleCount++;
                    }
                });

                var hasTitleFilter = query !== '';
                var hasPosterFilter = posterType !== 'all';
                var showClearBtn = hasTitleFilter || hasPosterFilter;

                if (clearBtn) {
                    clearBtn.style.display = showClearBtn ? 'inline-block' : 'none';
                }

                if (countEl) {
                    if (!hasTitleFilter && !hasPosterFilter) {
                        countEl.textContent = 'Showing ' + totalTours + ' trip' + (totalTours === 1 ? '' : 's') + '.';
                        countEl.style.display = '';
                    } else {
                        var filterParts = [];
                        if (hasTitleFilter) {
                            filterParts.push('matching "' + searchInput.value.trim() + '"');
                        }
                        if (hasPosterFilter) {
                            filterParts.push(getPosterFilterLabel(posterType));
                        }
                        countEl.textContent = 'Showing ' + visibleCount + ' of ' + totalTours + ' trip' + (totalTours === 1 ? '' : 's') + ' ' + filterParts.join(' and ') + '.';
                        countEl.style.display = visibleCount > 0 ? '' : 'none';
                    }
                }

                if (noMatchEl) {
                    if ((hasTitleFilter || hasPosterFilter) && visibleCount === 0) {
                        var noMatchParts = [];
                        if (hasTitleFilter) {
                            noMatchParts.push('matching "' + searchInput.value.trim() + '"');
                        }
                        if (hasPosterFilter) {
                            noMatchParts.push('for ' + getPosterFilterLabel(posterType));
                        }
                        noMatchEl.textContent = 'No trips found ' + noMatchParts.join(' and ') + '.';
                        noMatchEl.style.display = '';
                        tableWrap.style.display = 'none';
                    } else {
                        noMatchEl.style.display = 'none';
                        tableWrap.style.display = '';
                    }
                }
            }

            searchInput.addEventListener('input', updateTourFilter);

            if (posterFilter) {
                posterFilter.addEventListener('change', updateTourFilter);
            }

            if (clearBtn) {
                clearBtn.addEventListener('click', function () {
                    searchInput.value = '';
                    if (posterFilter) {
                        posterFilter.value = 'all';
                    }
                    searchInput.focus();
                    updateTourFilter();
                });
            }
        });
        </script>

    <?php else : ?>

    <?php if ($is_edit) : ?>
        <a href="<?php echo esc_url(add_query_arg('tab', 'manage', $page_base_url)); ?>" class="ftc-back-link"><i class="fas fa-arrow-left"></i> Back to My Trips</a>
    <?php endif; ?>

    <?php if ($success_message): ?>
        <div class="ftc-alert ftc-success"><i class="fas fa-check-circle"></i> <?php echo wp_kses_post($success_message); ?></div>
    <?php endif; ?>
    <?php if ($error_message): ?>
        <div class="ftc-alert ftc-error"><i class="fas fa-exclamation-circle"></i> <?php echo esc_html($error_message); ?></div>
    <?php endif; ?>

    <form action="" method="POST" enctype="multipart/form-data" id="tripanza-tour-builder-form">
        <?php wp_nonce_field('submit_st_tour_action', 'st_tour_nonce_field'); ?>
        <input type="hidden" name="submit_tour_form" value="1">

        <?php if ($is_read_only_resale) : ?>
            <div class="ftc-readonly-notice" role="note">
                <i class="fas fa-lock" aria-hidden="true"></i>
                <div><strong>Master-trip copy · read-only</strong>This trip inherits its itinerary, accommodation, dates, pricing and booking settings from the original trip. Hosts can review these details here, but only an administrator can change them.</div>
            </div>
        <?php endif; ?>

        <fieldset class="ftc-readonly-fieldset" <?php disabled($is_read_only_resale); ?>>

        <div class="tp-builder-map" aria-label="Trip builder flow">
            <span><b>01 · STORY</b>Basics, itinerary and stays</span>
            <span><b>02 · BOOKING</b>Dates, prices and capacity</span>
            <span><b>03 · LAUNCH</b>Media, categories and publish</span>
        </div>

     <!-- AI ASSISTANT UI - Display logic added to completely hide on Edit Screen -->
<?php if (!$is_edit) : ?>
<div class="ai-assistant-card">
    <div class="ai-assistant-title">
        <span class="sparkle">&#10022;</span> Start faster with AI
    </div>
    <p class="ai-assistant-desc">
        Paste an itinerary, a website URL, or a public Google Drive PDF. Tripanza will map the useful details into the builder for you to review.
    </p>
    
    <textarea id="ai_raw_text" class="ai-assistant-input" rows="3" placeholder="Paste itinerary text or a public link..."></textarea>
    
    <button type="button" id="ai_generate_btn" class="ai-assistant-btn">
        <i class="fas fa-wand-magic-sparkles"></i> Build my first draft
    </button>
    
    <div id="ai_status" class="ai-status-msg"></div>
</div>
<?php endif; ?>
<!-- END AI ASSISTANT UI -->

        <div class="ftc-section">
            <div class="ftc-section-title"><i class="fas fa-file-alt"></i> 1. Itinerary and Inclusion Section</div>
            <div class="ftc-form-group">
                <label>Tour Title *</label>
                <input type="text" name="tour_title" value="<?php echo $is_edit ? esc_attr($tour_post->post_title) : ''; ?>" required>
            </div>
            
            <div class="ftc-grid">
                <div class="ftc-form-group"><label>Short Itinerary</label><textarea name="tours_highlight" rows="2"><?php echo esc_textarea($saved_highlight_text); ?></textarea></div>
                
                <div class="ftc-form-group"><label>What is Included</label><textarea name="tours_include" rows="2"><?php echo esc_textarea($saved_include_text); ?></textarea></div>
                <div class="ftc-form-group"><label>What is Excluded</label><textarea name="tours_exclude" rows="2"><?php echo esc_textarea($saved_exclude_text); ?></textarea></div>
            </div>
        </div>

        <div class="ftc-section">
            <div class="ftc-section-title"><i class="fas fa-images"></i> 2. Trip Cover, Poster & Gallery</div>
            <div class="ftc-grid">
                
                <div class="ftc-form-group full-width">
                    <label>Featured Cover Image</label>
                    <div class="media-uploader-row">
                        <input type="hidden" name="st_tours_image" id="st_tours_image_val" value="<?php echo esc_attr($saved_featured_cover_id); ?>">
                        <input type="file" name="tp_featured_image_file" id="tp_featured_image_file" class="direct-media-input" accept="image/jpeg,image/png,image/webp,image/gif" data-preview="st_tours_image_prev" hidden>
                        <button type="button" class="upload-trigger-btn" data-file-input="tp_featured_image_file">Choose from device</button>
                    </div>
                    <div class="media-preview-item" id="st_tours_image_preview_item" style="<?php echo empty($saved_featured_cover_url) ? 'display:none;' : ''; ?>">
                        <img id="st_tours_image_prev" class="media-preview-img" src="<?php echo esc_url($saved_featured_cover_url); ?>">
                        <button type="button" class="media-preview-remove" data-remove-media data-file-input="tp_featured_image_file" data-hidden-input="st_tours_image_val" data-preview="st_tours_image_prev" aria-label="Remove featured cover">×</button>
                    </div>
                </div>
                <div class="ftc-form-group full-width">
                    <label>PDF Itinerary Cover Image</label>
                    <label class="media-option" for="use_featured_for_pdf">
                        <input type="checkbox" name="use_featured_for_pdf" id="use_featured_for_pdf" value="1" <?php checked($saved_pdf_uses_featured); ?>>
                        Use the Featured Cover Image for the PDF too
                    </label>
                    <div class="media-uploader-row" id="pdf-cover-controls">
                        <input type="hidden" name="_pdf_poster_image_id" id="_pdf_poster_val" value="<?php echo esc_attr($saved_pdf_cover_id); ?>">
                        <input type="file" name="tp_pdf_cover_file" id="tp_pdf_cover_file" class="direct-media-input" accept="image/jpeg,image/png,image/webp,image/gif" data-preview="_pdf_poster_prev" hidden>
                        <button type="button" class="upload-trigger-btn" data-file-input="tp_pdf_cover_file">Choose from device</button>
                    </div>
                    <div class="media-preview-item" id="_pdf_poster_preview_item" style="<?php echo (!$saved_pdf_uses_featured && !$saved_pdf_cover_id) || ($saved_pdf_uses_featured && !$saved_featured_cover_url) ? 'display:none;' : ''; ?>">
                        <img id="_pdf_poster_prev" class="media-preview-img" src="<?php echo esc_url($saved_pdf_uses_featured ? $saved_featured_cover_url : ($saved_pdf_cover_id ? wp_get_attachment_url($saved_pdf_cover_id) : '')); ?>">
                        <button type="button" class="media-preview-remove" data-remove-media data-file-input="tp_pdf_cover_file" data-hidden-input="_pdf_poster_val" data-preview="_pdf_poster_prev" aria-label="Remove PDF cover">×</button>
                    </div>
                </div>
                <div class="ftc-form-group full-width">
                    <label>Tour Gallery</label>
                    <div class="media-uploader-row">
                        <input type="hidden" name="gallery" id="st_gallery_val" value="<?php echo isset($meta_data['gallery']) ? esc_attr($meta_data['gallery']) : ''; ?>">
                        <input type="file" name="tp_gallery_files[]" id="tp_gallery_files" class="direct-gallery-input" accept="image/jpeg,image/png,image/webp,image/gif" data-preview-container="st_gallery_preview_container" multiple hidden>
                        <button type="button" class="upload-trigger-btn" data-file-input="tp_gallery_files">Choose photos from device</button>
                    </div>
                    <div id="st_gallery_preview_container" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
                        <?php 
                        if(!empty($meta_data['gallery'])) {
                            $g_ids = explode(',', $meta_data['gallery']);
                            foreach($g_ids as $g_id) {
                                $url = wp_get_attachment_url(intval($g_id));
                                if($url) echo '<span class="media-preview-item"><img class="media-preview-img" src="'.esc_url($url).'"><button type="button" class="media-preview-remove" data-remove-gallery-item data-file-input="tp_gallery_files" data-hidden-input="st_gallery_val" data-attachment-id="'.esc_attr(absint($g_id)).'" aria-label="Remove gallery image">×</button></span>';
                            }
                        }
                        ?>
                    </div>
                </div>
            </div>
        </div>

        <div class="ftc-section">
            <div class="ftc-section-title"><i class="fas fa-calendar-day"></i> 3. Day Wise Detailed Itinerary</div>
            <p class="ftc-optional-note">Day images are optional. Add them only when they improve the story.</p>
            <div class="ftc-grid" style="margin-bottom: 15px;">
               <div class="ftc-form-group" style="display: none;">
    <label>Itinerary Layout Style</label>
    <?php $selected_style = isset($meta_data['tours_program_style']) ? $meta_data['tours_program_style'] : ''; ?>
    <select name="tours_program_style">
        <option value="style1" <?php selected($selected_style, 'style1'); ?>>Default List Style</option>
        <option value="style2" <?php selected($selected_style, 'style2'); ?>>Accordion Layout</option>
        <option value="style3" <?php selected($selected_style, 'style3'); ?>>Timeline Track</option>
    </select>
</div>

<div class="ftc-form-group" style="display: none;">
    <label>Single Tour Layout Template ID</label>
    <input type="number" name="st_custom_layout_new" value="<?php echo isset($meta_data['st_custom_layout_new']) ? esc_attr($meta_data['st_custom_layout_new']) : '9'; ?>">
</div>
</div>
            <div id="itinerary-container"></div>
            <button type="button" class="add-row-btn" id="add-day-trigger"><i class="fas fa-plus"></i> Add Another Day</button>
        </div>

        <div class="ftc-section">
            <div class="ftc-section-title"><i class="fas fa-hotel"></i> 4. Accommodation <span style="font-weight:600;color:#64748b;">(Optional)</span></div>
            <p class="ftc-optional-note">Skip this entire section if accommodation is not included or not confirmed yet.</p>
            <div id="accommodation-repeater-wrapper"></div>
            <button type="button" class="add-row-btn blue-btn" id="add-accommodation"><i class="fas fa-plus"></i> Add Accommodation Day</button>
        </div>

        <div class="ftc-section">
            <div class="ftc-section-title"><i class="fas fa-question-circle"></i> 5. Frequently Asked Questions</div>
            <div id="faq-container"></div>
            <button type="button" class="add-row-btn blue-btn" id="add-faq-trigger"><i class="fas fa-plus"></i> Add New FAQ</button>
        </div>

        <div class="ftc-section">
            <div class="ftc-section-title"><i class="fas fa-gem"></i> 6. Extra Pricing Options / Upgrades</div>
            <div id="extra-container"></div>
            <button type="button" class="add-row-btn blue-btn" id="add-extra-trigger"><i class="fas fa-plus"></i> Add Upgrade Option</button>
        </div>

        <div class="ftc-section">
            <div class="ftc-section-title"><i class="fas fa-calendar-check"></i> 7. Trip Departure Dates & Specific Pricing</div>

            <?php if ($is_partner_owned_trip) : ?>
            <div class="tp-launch-offer">
                <div class="tp-launch-offer__icon">⚡</div>
                <div>
                    <strong>Tripanza Launch Offer · &#8377;500 for every confirmed person</strong>
                    <p>For every traveller whose booking is confirmed, Tripanza deducts &#8377;500 from the price you enter below. Example: if you list a sharing price at &#8377;8,000, you receive &#8377;7,500 per person on a direct sale. Set your customer prices with this fee in mind. There is no listing fee, subscription or upfront payment.</p>
                </div>
            </div>
            <?php endif; ?>

            <div class="tp-host-commission-box">
                <div class="tp-host-commission-box__head">
                    <div class="tp-host-commission-box__copy">
                        <strong>Want other hosts to bring you more bookings?</strong>
                        <p>
                            <?php if ($is_host_resale_copy) : ?>
                                This commission is set by the original trip owner and is inherited by this hosted storefront.
                            <?php elseif ($is_partner_owned_trip) : ?>
                                Enter an optional commission per confirmed person. If hosts find the reward attractive, they can promote your trip and bring bookings. It is deducted only when another host makes the sale, in addition to Tripanza's &#8377;500 fee.
                            <?php else : ?>
                                Enter the commission paid to a selling host for each confirmed person they bring. It applies only to host-generated sales.
                            <?php endif; ?>
                        </p>
                    </div>
                    <div class="tp-host-commission-box__field">
                        <label for="tripanza_host_commission_amount">Host commission per person (&#8377;)</label>
                        <input
                            type="number"
                            name="tripanza_host_commission_amount"
                            value="<?php echo isset($meta_data['tripanza_host_commission_amount']) ? esc_attr($meta_data['tripanza_host_commission_amount']) : ''; ?>"
                            placeholder="Optional · e.g. 500"
                            min="0"
                            step="1"
                            id="tripanza_host_commission_amount"
                            <?php echo $is_host_resale_copy ? 'readonly aria-readonly="true"' : ''; ?>
                        >
                    </div>
                </div>
            </div>
            
            <div class="ftc-bulk-tools">
                <div class="ftc-bulk-tools__title"><i class="fas fa-bolt"></i> Bulk Edit & Price Replication Tools</div>
                <div class="ftc-bulk-tools__row">
                    <div class="ftc-bulk-tools__field">
                        <label for="bulk_quad">Bulk Quad Price</label>
                        <input type="number" id="bulk_quad" placeholder="e.g. 5000">
                </div>
                    <div class="ftc-bulk-tools__field">
                        <label for="bulk_triple">Bulk Triple Price</label>
                        <input type="number" id="bulk_triple" placeholder="e.g. 6000">
                    </div>
                    <div class="ftc-bulk-tools__field">
                        <label for="bulk_twin">Bulk Twin Price</label>
                        <input type="number" id="bulk_twin" placeholder="e.g. 7500">
                    </div>
                    <button type="button" id="apply_bulk_prices" class="ftc-bulk-tools__apply"><i class="fas fa-check"></i> Apply to Existing Dates</button>
                    <label class="ftc-bulk-sync">
                        <input type="checkbox" id="sync_prices_checkbox" checked> Same price for all operating days (Auto-Sync)
                    </label>
                </div>
            </div>

            <div id="availability-container"></div>
            <button type="button" class="add-row-btn green-btn" id="add-avail-trigger"><i class="fas fa-plus"></i> Add Operating Date</button>
        </div>

        <div class="ftc-section">
            <div class="ftc-section-title"><i class="fas fa-cog"></i> 8. Logistics & Booking Form Display Options</div>
            <p class="ftc-field-hint">Disable Bookings Based On Room Sharing</p>
            <div class="checkbox-cluster">
                <div class="checkbox-item">
                    <input type="checkbox" name="hide_adult_in_booking_form" id="h_a" <?php checked(isset($meta_data['hide_adult_in_booking_form']) && $meta_data['hide_adult_in_booking_form'] === 'on'); ?>>
                    <label for="h_a">Disable Quad Sharing Bookings</label>
                </div>
                <div class="checkbox-item">
                    <input type="checkbox" name="hide_children_in_booking_form" id="h_c" <?php checked(isset($meta_data['hide_children_in_booking_form']) && $meta_data['hide_children_in_booking_form'] === 'on'); ?>>
                    <label for="h_c">Disable Triple Sharing Bookings</label>
                </div>
                <div class="checkbox-item">
                    <input type="checkbox" name="hide_infant_in_booking_form" id="h_i" <?php checked(isset($meta_data['hide_infant_in_booking_form']) && $meta_data['hide_infant_in_booking_form'] === 'on'); ?>>
                    <label for="h_i">Disable Twin Sharing Bookings</label>
                </div>
            </div>
           
            <div class="ftc-grid">
                <div class="ftc-form-group"><label>Duration (e.g., 1N/2D)</label><input type="text" name="duration_day" id="duration_day_input" placeholder="1N/2D" value="<?php echo isset($meta_data['duration_day']) ? esc_attr($meta_data['duration_day']) : '1'; ?>"></div>
                <div class="ftc-form-group"><label>Max number of people</label><input type="number" name="max_people" value="<?php echo isset($meta_data['max_people']) ? esc_attr($meta_data['max_people']) : '20'; ?>"></div>
                <div class="ftc-form-group"><label>Min number of people</label><input type="number" name="min_people" value="<?php echo isset($meta_data['min_people']) ? esc_attr($meta_data['min_people']) : '1'; ?>"></div>
                <div class="ftc-form-group"><label>Minimum days to book before departure</label><input type="number" name="tours_booking_period" value="<?php echo isset($meta_data['tours_booking_period']) ? esc_attr($meta_data['tours_booking_period']) : '1'; ?>"></div>
                
                <div class="ftc-form-group"><label>Trip Ends?</label><input type="text" name="tour_dropoff" value="<?php echo isset($meta_data['_st_tour_dropoff']) ? esc_attr($meta_data['_st_tour_dropoff']) : ''; ?>"></div>
                <div class="ftc-form-group"><label>Trip To?</label><input type="text" name="tour_destination" value="<?php echo isset($meta_data['_st_tour_destination']) ? esc_attr($meta_data['_st_tour_destination']) : ''; ?>"></div>
                <div class="ftc-form-group"><label>Trip From?</label><input type="text" name="address" value="<?php echo isset($meta_data['address']) ? esc_attr($meta_data['address']) : ''; ?>"></div>
            </div>

            <div class="ftc-grid" style="margin-top: 15px; border-top: 1px dashed #ccc; padding-top: 15px;">
                <input type="hidden" name="deposit_payment_status" value="percent">
                <div class="ftc-grid">
                    <div class="ftc-form-group">
                        <label>Advance Deposit Percentage (%)</label>
                        <input type="number" name="deposit_payment_amount" min="0" max="100" placeholder="e.g., 25" value="<?php echo isset($meta_data['deposit_payment_amount']) ? esc_attr($meta_data['deposit_payment_amount']) : '25'; ?>">
                    </div>
                    <div class="ftc-form-group">
                        <label>Balance Payments Deadline(Days Before Departure)</label>
                        <input type="number" name="_st_balance_payment_days" placeholder="e.g., 7" value="<?php echo isset($meta_data['_st_balance_payment_days']) ? esc_attr($meta_data['_st_balance_payment_days']) : ''; ?>">
                    </div>
                </div>
            </div>
        </div>

        <!-- SECTION 9: TOUR CATEGORIES / TOUR TYPE -->
        <div class="ftc-section">
            <div class="ftc-section-title"><i class="fas fa-tags"></i> 9. Tour Category / Tour Type</div>
            <p class="ftc-field-hint">Select categories to organize this trip in search listings (can also be auto-mapped by AI):</p>
            <div class="ftc-category-grid">
                <?php if (!empty($all_categories) && !is_wp_error($all_categories)): ?>
                    <?php foreach ($all_categories as $cat): ?>
                        <label class="checkbox-item" style="font-size: 13px; display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" name="tour_categories[]" value="<?php echo esc_attr($cat->term_id); ?>" data-name="<?php echo esc_attr(strtolower($cat->name)); ?>" <?php checked(in_array($cat->term_id, $saved_categories)); ?>>
                            <?php echo esc_html($cat->name); ?>
                        </label>
                    <?php endforeach; ?>
                <?php else: ?>
                    <p style="font-size:13px; color:#999;">No category terms found in 'st_tour_type' taxonomy.</p>
                <?php endif; ?>
            </div>
        </div>

        <?php if (!empty($tripanza_display_sections)) : ?>
        <!-- SECTION 10: TRIPANZA PDF & EMAIL SETTINGS -->
        <div class="ftc-section">
            <div class="ftc-section-title"><i class="fas fa-file-pdf"></i> 10. Tripanza Settings (PDF & Email)</div>
            <p class="tripanza-settings-note">Configure how this tour appears in downloaded PDF itineraries and email itineraries. Uncheck a section to hide it for this tour only.</p>

            <p class="ftc-field-hint">Display Sections</p>
            <div class="tripanza-settings-grid">
                <?php foreach ($tripanza_display_sections as $section_key => $section_label) : ?>
                    <?php
                    $section_enabled = function_exists('tripanza_is_section_enabled')
                        ? tripanza_is_section_enabled($section_key, $is_edit ? $tour_id : null)
                        : true;
                    ?>
                    <label class="tripanza-settings-item">
                        <input type="checkbox" name="tripanza_show_<?php echo esc_attr($section_key); ?>" value="1" <?php checked($section_enabled, true); ?>>
                        <span><?php echo esc_html($section_label); ?></span>
                    </label>
                <?php endforeach; ?>
            </div>

            <?php if ($is_edit && $tour_id) : ?>
            <div class="tripanza-settings-actions">
                <button type="button" class="tripanza-settings-btn" id="tripanza-reset-pdf-design" data-post="<?php echo esc_attr($tour_id); ?>">Reset PDF Design to Defaults</button>
                <button type="button" class="tripanza-settings-btn" id="tripanza-clear-tour-cache" data-post="<?php echo esc_attr($tour_id); ?>">Clear Tour Cache</button>
                <span id="tripanza-settings-status" style="font-size:13px; font-weight:600; color:#137333; align-self:center;"></span>
            </div>
            <?php endif; ?>
        </div>
        <?php endif; ?>

        </fieldset>

        <?php if (!$is_read_only_resale) : ?>
            <button type="submit" class="ftc-btn" id="tripanza-tour-submit"><i class="fas fa-paper-plane"></i> <span><?php echo esc_html($is_edit ? 'Save trip updates' : ($is_admin_user ? 'Publish trip' : 'Send trip for review')); ?></span></button>
        <?php endif; ?>
    </form>

    <?php endif; ?>
        </div><!-- .tp-panel__body -->
    </div><!-- .tp-panel -->
</div><!-- .tripanza-tour-dashboard -->
</div><!-- .tripanza-tour-page -->

<template id="accommodation-template">
    <div class="accommodation-block" data-index="__index__">
        <button type="button" class="remove-accommodation">Remove Day</button>
        <div class="ftc-grid">
            <div class="ftc-form-group">
                <label>Title</label>
                <input type="text" name="st_tours_accommodation[__index__][title]" placeholder="Day Title or Destination Name"  />
            </div>
            <div class="ftc-form-group">
                <label>Location / Venue</label>
                <input type="text" name="st_tours_accommodation[__index__][location]" placeholder="City or Hotel Name" />
            </div>
        </div>
        <div class="ftc-form-group">
            <label>Property Type</label>
            <input type="text" name="st_tours_accommodation[__index__][type]" placeholder="Hotel / Resort / Homestay / Camp" />
        </div>
        <div class="ftc-form-group">
            <label>Detailed Description</label>
            <textarea name="st_tours_accommodation[__index__][desc]" rows="2">We usually book this hotel for our groups, but in rare cases of unavoidable circumstances, a similar or upgraded property may be provided. We highly recommend booking early to secure the specific property mentioned above.</textarea>
        </div>
        <div class="ftc-form-group">
            <label>Select Included Amenities</label>
            <div class="ftc-amenity-grid">
                <?php foreach ($amenities_list as $amenity): ?>
                    <label>
                        <input type="checkbox" name="st_tours_accommodation[__index__][amenities][]" value="<?php echo esc_attr($amenity); ?>">
                        <?php echo esc_html($amenity); ?>
                    </label>
                <?php endforeach; ?>
            </div>
        </div>
        <div class="ftc-form-group">
            <label>Accommodation Photos <span style="font-weight:500;color:#64748b;">(Optional)</span></label>
            <div class="media-uploader-row">
                <input type="hidden" class="gallery-ids" name="st_tours_accommodation[__index__][gallery]" />
                <input type="file" id="accom_gallery___index__" name="tp_accommodation_gallery[__index__][]" class="direct-gallery-input accommodation-gallery-input" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden>
                <button type="button" class="upload-trigger-btn" data-file-input="accom_gallery___index__">Choose photos from device</button>
            </div>
            <div class="gallery-preview-container" style="display:flex; gap:6px; flex-wrap:wrap; margin-top:6px;"></div>
        </div>
    </div>
</template>

<?php
// The normal theme footer is not rendered on this dashboard, so its queued
// media/date-picker dependencies must be printed before the form controller.
// WordPress tracks printed handles, making this safe if another wrapper has
// already output any of them.
wp_print_scripts(array('jquery-ui-datepicker'));
?>

<script>
document.addEventListener("DOMContentLoaded", function () {
    if (!document.getElementById('tripanza-tour-builder-form')) return;
    // Helper function to cleanly init the datepicker on operating dates
    let datePickerRetryTimer = null;
    let datePickerRetryCount = 0;
    function initDatePickerOnElements() {
        if (typeof jQuery !== 'undefined' && jQuery.fn.datepicker) {
            if (datePickerRetryTimer) {
                window.clearTimeout(datePickerRetryTimer);
                datePickerRetryTimer = null;
            }
            jQuery('.datepicker-init').each(function() {
                // Ensure datepicker is not double bound
                if (!jQuery(this).hasClass('hasDatepicker')) {
                    jQuery(this).datepicker({
                        dateFormat: 'dd/mm/yy',
                        changeMonth: true,
                        changeYear: true,
                        minDate: 0,
                        showOn: 'focus'
                    });
                }
            });
            return;
        }

        // LiteSpeed/Cloudflare may defer dependencies even when their tags are
        // printed first. Retry briefly instead of leaving a dead readonly field.
        if (datePickerRetryCount < 20 && !datePickerRetryTimer) {
            datePickerRetryCount++;
            datePickerRetryTimer = window.setTimeout(function () {
                datePickerRetryTimer = null;
                initDatePickerOnElements();
            }, 250);
        }
    }

    window.addEventListener('load', initDatePickerOnElements);

    // Direct device uploads: buttons open the native mobile/desktop picker.
    function renderSelectedFiles(input) {
        const files = Array.from(input.files || []);
        if (!files.length) return;
        if (files.some(file => !/^image\/(jpeg|png|webp|gif)$/i.test(file.type))) {
            input.value = '';
            window.alert('Choose JPG, PNG, WebP or GIF images only.');
            return;
        }
        const trigger = Array.from(document.querySelectorAll('.upload-trigger-btn[data-file-input]')).find(button => button.dataset.fileInput === input.id);
        if (trigger) trigger.textContent = files.length === 1 ? '1 photo ready' : files.length + ' photos ready';
        const previewId = input.dataset.preview || '';
        const containerId = input.dataset.previewContainer || '';
        if (previewId) {
            const preview = document.getElementById(previewId);
            if (preview) {
                preview.src = URL.createObjectURL(files[0]);
                const previewItem = preview.closest('.media-preview-item');
                if (previewItem) previewItem.style.display = 'inline-block';
                if (input.id === 'tp_pdf_cover_file') preview.dataset.ownSrc = preview.src;
            }
        }
        let container = containerId ? document.getElementById(containerId) : null;
        if (!container && input.classList.contains('accommodation-gallery-input')) {
            const block = input.closest('.accommodation-block');
            container = block && block.querySelector('.gallery-preview-container');
        }
        if (!container && input.classList.contains('itinerary-image-input')) {
            const block = input.closest('.itinerary-day-box');
            const preview = block && block.querySelector('.itinerary-image-preview');
            if (preview) {
                preview.src = URL.createObjectURL(files[0]);
                const previewItem = preview.closest('.media-preview-item');
                if (previewItem) previewItem.style.display = 'inline-block';
            }
        }
        if (container) {
            container.innerHTML = '';
            const scope = input.closest('.ftc-form-group, .accommodation-block');
            const hidden = input.id === 'tp_gallery_files'
                ? document.getElementById('st_gallery_val')
                : (scope && scope.querySelector('.gallery-ids'));
            if (hidden) hidden.value = '';
            files.forEach(function(file, fileIndex) {
                const item = document.createElement('span');
                item.className = 'media-preview-item';
                const image = document.createElement('img');
                image.className = 'media-preview-img';
                image.src = URL.createObjectURL(file);
                image.alt = '';
                const remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'media-preview-remove';
                remove.dataset.removeGalleryItem = '';
                remove.dataset.fileInput = input.id;
                remove.dataset.fileIndex = String(fileIndex);
                remove.setAttribute('aria-label', 'Remove selected image');
                remove.textContent = '×';
                item.appendChild(image);
                item.appendChild(remove);
                container.appendChild(item);
            });
        }
        if (input.id === 'tp_featured_image_file') syncPdfCoverChoice();
    }

    function resetUploadTrigger(input) {
        if (!input) return;
        const trigger = Array.from(document.querySelectorAll('.upload-trigger-btn[data-file-input]')).find(button => button.dataset.fileInput === input.id);
        if (trigger) trigger.textContent = input.multiple ? 'Choose photos from device' : 'Choose from device';
    }

    function removeSingleMedia(button) {
        const input = document.getElementById(button.dataset.fileInput || '');
        const hidden = document.getElementById(button.dataset.hiddenInput || '');
        const group = button.closest('.ftc-form-group, .itinerary-day-box');
        const preview = button.dataset.preview
            ? document.getElementById(button.dataset.preview)
            : (group && group.querySelector('.itinerary-image-preview'));
        if (input) input.value = '';
        if (hidden) hidden.value = '';
        if (preview) {
            preview.removeAttribute('src');
            const previewItem = preview.closest('.media-preview-item');
            if (previewItem) previewItem.style.display = 'none';
            if (preview.dataset.ownSrc) preview.dataset.ownSrc = '';
        }
        resetUploadTrigger(input);
        if (input && input.id === 'tp_featured_image_file') syncPdfCoverChoice();
        if (input && input.id === 'tp_pdf_cover_file') {
            const checkbox = document.getElementById('use_featured_for_pdf');
            if (checkbox && checkbox.checked) checkbox.checked = false;
            syncPdfCoverChoice();
        }
    }

    function removeGalleryItem(button) {
        const input = document.getElementById(button.dataset.fileInput || '');
        const scope = button.closest('.ftc-form-group, .accommodation-block');
        const hidden = button.dataset.hiddenInput
            ? document.getElementById(button.dataset.hiddenInput)
            : (scope && scope.querySelector('.gallery-ids'));
        const attachmentId = parseInt(button.dataset.attachmentId || '0', 10);
        const fileIndex = parseInt(button.dataset.fileIndex || '-1', 10);

        if (attachmentId && hidden) {
            hidden.value = hidden.value.split(',').map(value => parseInt(value, 10)).filter(value => value && value !== attachmentId).join(',');
            const item = button.closest('.media-preview-item');
            if (item) item.remove();
            return;
        }

        if (input && fileIndex >= 0 && typeof DataTransfer !== 'undefined') {
            const transfer = new DataTransfer();
            Array.from(input.files || []).forEach(function(file, index) {
                if (index !== fileIndex) transfer.items.add(file);
            });
            input.files = transfer.files;
            if (input.files.length) {
                renderSelectedFiles(input);
            } else {
                const container = scope && scope.querySelector(input.id === 'tp_gallery_files' ? '#st_gallery_preview_container' : '.gallery-preview-container');
                if (container) container.innerHTML = '';
                resetUploadTrigger(input);
            }
        } else if (input && fileIndex >= 0) {
            // Safe fallback for older mobile browsers that cannot rebuild a FileList.
            input.value = '';
            const container = scope && scope.querySelector(input.id === 'tp_gallery_files' ? '#st_gallery_preview_container' : '.gallery-preview-container');
            if (container) container.innerHTML = '';
            resetUploadTrigger(input);
        }
    }

    function syncPdfCoverChoice() {
        const checkbox = document.getElementById('use_featured_for_pdf');
        const controls = document.getElementById('pdf-cover-controls');
        const pdfPreview = document.getElementById('_pdf_poster_prev');
        const featuredPreview = document.getElementById('st_tours_image_prev');
        const pdfFile = document.getElementById('tp_pdf_cover_file');
        if (!checkbox || !controls || !pdfPreview) return;

        controls.style.display = checkbox.checked ? 'none' : 'flex';
        if (checkbox.checked) {
            if (pdfFile) {
                pdfFile.value = '';
                resetUploadTrigger(pdfFile);
            }
            const featuredSrc = featuredPreview && featuredPreview.getAttribute('src');
            if (featuredSrc) {
                pdfPreview.src = featuredSrc;
                const previewItem = pdfPreview.closest('.media-preview-item');
                if (previewItem) previewItem.style.display = 'inline-block';
            } else {
                pdfPreview.removeAttribute('src');
                const previewItem = pdfPreview.closest('.media-preview-item');
                if (previewItem) previewItem.style.display = 'none';
            }
        } else {
            const ownSrc = pdfPreview.dataset.ownSrc || '';
            if (ownSrc) {
                pdfPreview.src = ownSrc;
                const previewItem = pdfPreview.closest('.media-preview-item');
                if (previewItem) previewItem.style.display = 'inline-block';
            } else {
                pdfPreview.removeAttribute('src');
                const previewItem = pdfPreview.closest('.media-preview-item');
                if (previewItem) previewItem.style.display = 'none';
            }
        }
    }

    document.addEventListener('click', function(event) {
        const removeMediaButton = event.target.closest('[data-remove-media]');
        if (removeMediaButton) {
            event.preventDefault();
            removeSingleMedia(removeMediaButton);
            return;
        }
        const removeGalleryButton = event.target.closest('[data-remove-gallery-item]');
        if (removeGalleryButton) {
            event.preventDefault();
            removeGalleryItem(removeGalleryButton);
            return;
        }
        const button = event.target.closest('.upload-trigger-btn[data-file-input]');
        if (!button) return;
        event.preventDefault();
        const input = document.getElementById(button.dataset.fileInput || '');
        if (input) input.click();
    });
    document.addEventListener('change', function(event) {
        if (!event.target.matches('.direct-media-input,.direct-gallery-input')) return;
        renderSelectedFiles(event.target);
    });
    const pdfSameAsFeatured = document.getElementById('use_featured_for_pdf');
    const pdfPreview = document.getElementById('_pdf_poster_prev');
    if (pdfPreview) pdfPreview.dataset.ownSrc = <?php echo wp_json_encode($saved_pdf_cover_id ? wp_get_attachment_url($saved_pdf_cover_id) : ''); ?>;
    if (pdfSameAsFeatured) {
        pdfSameAsFeatured.addEventListener('change', syncPdfCoverChoice);
        syncPdfCoverChoice();
    }

    // Core Dynamic Row Handlers
    let dayCount = 0;
    let faqCount = 0;
    let extraCount = 0;
    let availCount = 0;
    let accomCount = 0;

    const itinContainer = document.getElementById('itinerary-container');
    const addDayBtn     = document.getElementById('add-day-trigger');
    const faqContainer  = document.getElementById('faq-container');
    const addFaqBtn     = document.getElementById('add-faq-trigger');
    const extraContainer = document.getElementById('extra-container');
    const addExtraBtn   = document.getElementById('add-extra-trigger');
    const availContainer = document.getElementById('availability-container');
    const addAvailBtn   = document.getElementById('add-avail-trigger');
    const durationInput = document.getElementById('duration_day_input');

    // Functions to construct standard dynamic blocks
    function updateLabelsAndDuration() {
        const rows = itinContainer.querySelectorAll('.itinerary-day-box');
        rows.forEach((row, i) => {
            row.querySelector('.day-label-idx').innerText = i + 1;
        });
        
        if(durationInput && (!durationInput.value || /^\d+$/.test(durationInput.value.trim()))) {
            durationInput.value = rows.length > 0 ? rows.length : 1;
        }
    }

    function createItineraryRow(idx, data = {}) {
        const title = escapeHtml(data.title || '');
        const desc = escapeHtml(data.desc || '');
        const img = escapeHtml(data.image || '');
        const html = `
        <div class="itinerary-day-box" data-index="${idx}">
            <button type="button" class="remove-row-btn remove-itin-btn"><i class="fas fa-times"></i> Remove Day</button>
            <div class="ftc-day-label"><i class="fas fa-sun"></i> Day <span class="day-label-idx">${idx+1}</span></div>
            <div class="ftc-grid">
                <div class="ftc-form-group"><label>Title</label><input type="text" name="itinerary[${idx}][title]" value="${title}" required></div>
                <div class="ftc-form-group"><label>Image <span style="font-weight:500;color:#64748b;">(Optional)</span></label>
                    <div class="media-uploader-row">
                        <input type="hidden" name="itinerary[${idx}][image]" id="itin_img_${idx}" value="${img}">
                        <input type="file" name="tp_itinerary_image[${idx}]" id="itin_file_${idx}" class="direct-media-input itinerary-image-input" accept="image/jpeg,image/png,image/webp,image/gif" hidden>
                        <button type="button" class="upload-trigger-btn" data-file-input="itin_file_${idx}">Choose from device</button>
                    </div>
                    <span class="media-preview-item itinerary-preview-item" style="${img ? '' : 'display:none;'}">
                        <img class="media-preview-img itinerary-image-preview" src="${img}">
                        <button type="button" class="media-preview-remove" data-remove-media data-file-input="itin_file_${idx}" data-hidden-input="itin_img_${idx}" aria-label="Remove itinerary image">×</button>
                    </span>
                </div>
            </div>
            <div class="ftc-form-group"><label>Description</label><textarea name="itinerary[${idx}][desc]" rows="2">${desc}</textarea></div>
        </div>`;
        itinContainer.insertAdjacentHTML('beforeend', html);
    }

    function createFaqRow(idx, data = {}) {
        const html = `
        <div class="faq-row-box">
            <button type="button" class="remove-row-btn">Remove FAQ</button>
            <div class="ftc-form-group"><label>FAQ Question Title</label><input type="text" name="faq[${idx}][title]" value="${escapeHtml(data.title || '')}"></div>
            <div class="ftc-form-group"><label>FAQ Answer Block</label><textarea name="faq[${idx}][desc]" rows="2">${escapeHtml(data.desc || '')}</textarea></div>
        </div>`;
        faqContainer.insertAdjacentHTML('beforeend', html);
    }

    function createExtraRow(idx, data = {}) {
        const type = data.type || 'person';
        const reqChecked = data.extra_required === 'on' ? 'checked' : '';
        const html = `
        <div class="extra-row-box">
            <button type="button" class="remove-row-btn">Remove Upgrade</button>
            <div class="ftc-grid three-cols">
                <div class="ftc-form-group"><label>Upgrade Service Label Title</label><input type="text" name="extra[${idx}][title]" value="${escapeHtml(data.title || '')}"></div>
                <div class="ftc-form-group"><label>Add-on Premium Cost Price</label><input type="text" name="extra[${idx}][price]" value="${escapeHtml(data.price || '0')}"></div>
                <div class="ftc-form-group"><label>Calculation Billing Engine</label>
                    <select name="extra[${idx}][type]">
                        <option value="person" ${type==='person'?'selected':''}>Per Passenger Head Count</option>
                        <option value="booking" ${type==='booking'?'selected':''}>Flat Fee Per Absolute Booking</option>
                    </select>
                </div>
            </div>
            <div class="checkbox-item"><input type="checkbox" name="extra[${idx}][required]" ${reqChecked}> <label>Mandatory forced addition fee upgrade cost during entry</label></div>
        </div>`;
        extraContainer.insertAdjacentHTML('beforeend', html);
    }

    const showOwnerPayoutPreview = <?php echo $is_partner_owned_trip ? 'true' : 'false'; ?>;
    const tripanzaLaunchFeePerPerson = <?php echo wp_json_encode((float) $tripanza_launch_fee_pp); ?>;

   function createAvailRow(idx, data = {}) {
        // If adding a blank entry, check if pricing should replicate from bulk values or the first active row
        if (!data.quad && !data.triple && !data.twin) {
            const syncCb = document.getElementById('sync_prices_checkbox');
            if (syncCb && syncCb.checked) {
                const firstQuad = document.querySelector('#availability-container input[name*="[quad]"]');
                const firstTriple = document.querySelector('#availability-container input[name*="[triple]"]');
                const firstTwin = document.querySelector('#availability-container input[name*="[twin]"]');
                if (firstQuad) data.quad = firstQuad.value;
                if (firstTriple) data.triple = firstTriple.value;
                if (firstTwin) data.twin = firstTwin.value;
            } else {
                const bQ = document.getElementById('bulk_quad') ? document.getElementById('bulk_quad').value : '';
                const bT = document.getElementById('bulk_triple') ? document.getElementById('bulk_triple').value : '';
                const bW = document.getElementById('bulk_twin') ? document.getElementById('bulk_twin').value : '';
                if (bQ) data.quad = bQ;
                if (bT) data.triple = bT;
                if (bW) data.twin = bW;
            }
        }

        const cleanPrice = (val) => {
            if (val === 0 || val === '0') return '0';
            if (!val) return '';
            return val.toString().replace(/[^0-9.]/g, ''); 
        };

        const quadPrice   = cleanPrice(data.quad);
        const triplePrice = cleanPrice(data.triple);
        const twinPrice   = cleanPrice(data.twin);
        const moneyLabel = value => '₹' + Math.max(0, Number(value) || 0).toLocaleString('en-IN', {maximumFractionDigits: 2});
        const payoutPreview = type => showOwnerPayoutPreview ? `
            <div class="tp-inline-payout">
                <span>Tripanza fee / person <b>${moneyLabel(tripanzaLaunchFeePerPerson)}</b></span>
                <span data-host-commission-row="${type}" hidden>Host commission / person <b data-host-commission="${type}">—</b></span>
                <span class="is-owner-total">You'll get on a direct sale <b data-owner-direct="${type}">—</b></span>
                <span class="is-owner-total" data-owner-assisted-row="${type}" hidden>You'll get when a host sells <b data-owner-assisted="${type}">—</b></span>
            </div>` : '';

        // Fixed structure utilizing unified row alignments instead of interior grids
        const html = `
        <div class="avail-date-box">
            <button type="button" class="remove-row-btn">Remove Date</button>
            <div class="avail-date-row-grid">
                <div class="ftc-form-group">
                    <label>Departure Calendar Date * (DD/MM/YYYY)</label>
                    <input type="text" class="datepicker-init" name="availability[${idx}][date]" placeholder="Click to select Date" value="${escapeHtml(data.date || '')}" required autocomplete="off" readonly>
                </div>
                <div class="ftc-form-group"><label>Quad Sharing (&#8377;)</label><input type="number" name="availability[${idx}][quad]" value="${quadPrice}">${payoutPreview('quad')}</div>
                <div class="ftc-form-group"><label>Triple Sharing (&#8377;)</label><input type="number" name="availability[${idx}][triple]" value="${triplePrice}">${payoutPreview('triple')}</div>
                <div class="ftc-form-group"><label>Twin Sharing (&#8377;)</label><input type="number" name="availability[${idx}][twin]" value="${twinPrice}">${payoutPreview('twin')}</div>
            </div>
        </div>`;
        availContainer.insertAdjacentHTML('beforeend', html);
        updateOwnerPayoutPreviews();
        initDatePickerOnElements(); 
    }

    function updateOwnerPayoutPreviews() {
        if (!showOwnerPayoutPreview || !availContainer) return;
        const commissionInput = document.getElementById('tripanza_host_commission_amount');
        const optionalCommission = Math.max(0, parseFloat(commissionInput ? commissionInput.value : 0) || 0);
        const money = value => '₹' + Math.max(0, value).toLocaleString('en-IN', {maximumFractionDigits: 2});
        availContainer.querySelectorAll('.avail-date-box').forEach(function(row) {
            ['quad', 'triple', 'twin'].forEach(function(type) {
                const input = row.querySelector(`input[name*="[${type}]"]`);
                const value = Math.max(0, parseFloat(input ? input.value : 0) || 0);
                const directOutput = row.querySelector(`[data-owner-direct="${type}"]`);
                const assistedOutput = row.querySelector(`[data-owner-assisted="${type}"]`);
                const commissionOutput = row.querySelector(`[data-host-commission="${type}"]`);
                const commissionRow = row.querySelector(`[data-host-commission-row="${type}"]`);
                const assistedRow = row.querySelector(`[data-owner-assisted-row="${type}"]`);
                if (commissionOutput) commissionOutput.textContent = money(optionalCommission);
                if (commissionRow) commissionRow.hidden = optionalCommission <= 0;
                if (assistedRow) assistedRow.hidden = optionalCommission <= 0;
                if (directOutput) directOutput.textContent = value > 0 ? money(value - tripanzaLaunchFeePerPerson) : '—';
                if (assistedOutput) assistedOutput.textContent = value > 0 ? money(value - tripanzaLaunchFeePerPerson - optionalCommission) : '—';
            });
        });
    }

    // --- BULK PRICE UPDATER ACTION HANDLERS ---
    const applyBulkBtn = document.getElementById('apply_bulk_prices');
    if (applyBulkBtn) {
        applyBulkBtn.addEventListener('click', function() {
            const bQ = document.getElementById('bulk_quad').value;
            const bT = document.getElementById('bulk_triple').value;
            const bW = document.getElementById('bulk_twin').value;
            
            if (bQ !== '') document.querySelectorAll('#availability-container input[name*="[quad]"]').forEach(el => el.value = bQ);
            if (bT !== '') document.querySelectorAll('#availability-container input[name*="[triple]"]').forEach(el => el.value = bT);
            if (bW !== '') document.querySelectorAll('#availability-container input[name*="[twin]"]').forEach(el => el.value = bW);
            updateOwnerPayoutPreviews();
        });
    }

    // --- INTER-ROW LIVE SYNCHRONIZATION ENGINE ---
    if (availContainer) {
        availContainer.addEventListener('input', function(e) {
            const syncCb = document.getElementById('sync_prices_checkbox');
            if (syncCb && syncCb.checked) {
                if (e.target.name) {
                    let targetSelector = '';
                    if (e.target.name.includes('[quad]')) targetSelector = 'input[name*="[quad]"]';
                    else if (e.target.name.includes('[triple]')) targetSelector = 'input[name*="[triple]"]';
                    else if (e.target.name.includes('[twin]')) targetSelector = 'input[name*="[twin]"]';
                    
                    if (targetSelector) {
                        const val = e.target.value;
                        document.querySelectorAll('#availability-container ' + targetSelector).forEach(input => {
                            input.value = val;
                        });
                    }
                }
            }
            updateOwnerPayoutPreviews();
        });
    }

    const commissionAmountInput = document.getElementById('tripanza_host_commission_amount');
    if (commissionAmountInput) commissionAmountInput.addEventListener('input', updateOwnerPayoutPreviews);

    // --- ACCOMMODATION REPEATER IMPLEMENTATION ENGINE ---
    const accomWrapper = document.getElementById("accommodation-repeater-wrapper");
    const accomTemplate = document.getElementById("accommodation-template").innerHTML;
    const addAccomBtn = document.getElementById("add-accommodation");

    function renderPreloadedAccommodation(item) {
        let html = accomTemplate.replace(/__index__/g, accomCount);
        accomWrapper.insertAdjacentHTML('beforeend', html);
        
        let block = accomWrapper.querySelector(`.accommodation-block[data-index="${accomCount}"]`);
        
        block.querySelector('input[name*="[title]"]').value = item.title || '';
        block.querySelector('input[name*="[location]"]').value = item.location || '';
        block.querySelector('input[name*="[type]"]').value = item.type || '';
        block.querySelector('textarea[name*="[desc]"]').value = item.desc || '';
        block.querySelector('.gallery-ids').value = item.gallery || '';
        
        if(item.amenities) {
            let savedAmenities = item.amenities.split(',').map(s => s.trim());
            savedAmenities.forEach(amenity => {
                let checkbox = block.querySelector(`input[type="checkbox"][value="${amenity.replace(/"/g, '\\"')}"]`);
                if(checkbox) checkbox.checked = true;
            });
        }
        
        if(Array.isArray(item.gallery_urls)) {
            let previewContainer = block.querySelector('.gallery-preview-container');
            const galleryIds = String(item.gallery || '').split(',');
            item.gallery_urls.forEach((url, imageIndex) => {
                const attachmentId = parseInt(galleryIds[imageIndex] || '0', 10);
                previewContainer.insertAdjacentHTML('beforeend', `<span class="media-preview-item"><img class="media-preview-img" src="${escapeHtml(url)}" alt=""><button type="button" class="media-preview-remove" data-remove-gallery-item data-file-input="accom_gallery_${accomCount}" data-attachment-id="${attachmentId}" aria-label="Remove accommodation image">×</button></span>`);
            });
        }
        accomCount++;
    }

    addAccomBtn.addEventListener("click", function () {
        const html = accomTemplate.replace(/__index__/g, accomCount);
        accomWrapper.insertAdjacentHTML('beforeend', html);
        accomCount++;
    });

    // Delegated click event engine for accommodation blocks
    accomWrapper.addEventListener("click", function (e) {
        if (e.target.classList.contains("remove-accommodation")) {
            e.target.closest(".accommodation-block").remove();
        }

    });

    // Traditional Global Block Listeners
    addDayBtn.addEventListener('click', () => { createItineraryRow(dayCount); dayCount++; updateLabelsAndDuration(); });
    addFaqBtn.addEventListener('click', () => { createFaqRow(faqCount); faqCount++; });
    addExtraBtn.addEventListener('click', () => { createExtraRow(extraCount); extraCount++; });
    addAvailBtn.addEventListener('click', () => { createAvailRow(availCount); availCount++; });

    itinContainer.addEventListener('click', (e) => {
        if(e.target.classList.contains('remove-itin-btn')) {
            e.target.closest('.itinerary-day-box').remove();
            updateLabelsAndDuration();
        }
    });

    faqContainer.addEventListener('click', (e) => { if(e.target.classList.contains('remove-row-btn')) e.target.closest('.faq-row-box').remove(); });
    extraContainer.addEventListener('click', (e) => { if(e.target.classList.contains('remove-row-btn')) e.target.closest('.extra-row-box').remove(); });
    availContainer.addEventListener('click', (e) => { if(e.target.classList.contains('remove-row-btn')) e.target.closest('.avail-date-box').remove(); });

    function escapeHtml(text) {
        if (text === 0 || text === '0') return '0'; 
        if (!text) return '';
        return text.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
    
   // --- AI ASSISTANT JS LOGIC ---
    const aiBtn = document.getElementById('ai_generate_btn');
    if (aiBtn) {
        aiBtn.addEventListener('click', function() {
            const rawText = document.getElementById('ai_raw_text').value.trim();
            if (!rawText) {
                alert('Please paste some text, a website link, or a Google Drive link for the AI to analyze.');
                return;
            }
            
            const statusEl = document.getElementById('ai_status');
            statusEl.style.display = 'block';
            statusEl.style.color = '#10a37f';
            statusEl.innerText = 'AI is reading your itinerary and mapping the fields...';
            aiBtn.disabled = true;
            aiBtn.style.opacity = '0.7';
            
            const formData = new FormData();
            formData.append('action', 'ai_parse_itinerary');
            formData.append('raw_text', rawText);
            formData.append('ai_nonce', <?php echo wp_json_encode(wp_create_nonce('ftc_ai_parse_itinerary')); ?>);
            
            fetch(window.TRIPANZA_STUDIO.endpoint, {
                method: 'POST',
                body: formData
            })
            .then(res => res.json())
            .then(res => {
                aiBtn.disabled = false;
                aiBtn.style.opacity = '1';
                
                if (res.success && res.data) {
                    const d = res.data;
                    
                    // Map basic input fields safely
                    if (d.tour_title) document.querySelector('input[name="tour_title"]').value = d.tour_title;
                    if (d.tours_include) document.querySelector('textarea[name="tours_include"]').value = d.tours_include;
                    if (d.tours_exclude) document.querySelector('textarea[name="tours_exclude"]').value = d.tours_exclude;
                    if (d.duration_day) document.querySelector('input[name="duration_day"]').value = d.duration_day;
                    if (d.max_people) document.querySelector('input[name="max_people"]').value = d.max_people;
                    if (d.min_people) document.querySelector('input[name="min_people"]').value = d.min_people;
                    if (d.tour_destination) document.querySelector('input[name="tour_destination"]').value = d.tour_destination;
                    if (d.address) document.querySelector('input[name="address"]').value = d.address;
                    
                    // --- INTELLIGENT DIRECT CATEGORY MAPPING ---
                    const categoryCheckboxes = document.querySelectorAll('input[name="tour_categories[]"]');
                    
                    // First, uncheck any previously selected options to start fresh
                    categoryCheckboxes.forEach(cb => cb.checked = false);

                    if (d.categories && Array.isArray(d.categories) && d.categories.length > 0) {
                        categoryCheckboxes.forEach(cb => {
                            const cbName = (cb.getAttribute('data-name') || '').trim().toLowerCase();
                            
                            // Perform a reliable, case-insensitive match (exact or substring)
                            const isMatch = d.categories.some(aiCat => {
                                const aiCatLower = (aiCat || '').trim().toLowerCase();
                                return cbName === aiCatLower || cbName.includes(aiCatLower) || aiCatLower.includes(cbName);
                            });
                            
                            if (isMatch) {
                                cb.checked = true;
                            }
                        });
                    }

                    // Map Short Itinerary (combines day titles dynamically)
                    if (d.itinerary && Array.isArray(d.itinerary) && d.itinerary.length > 0) {
                        const shortItineraryBox = document.querySelector('textarea[name="tours_highlight"]');
                        if (shortItineraryBox) {
                            shortItineraryBox.value = d.itinerary.map((day, idx) => `Day ${idx + 1}: ${day.title}`).join('\n');
                        }

                        // Map detailed day-by-day itinerary
                        const container = document.getElementById('itinerary-container');
                        container.innerHTML = ''; 
                        dayCount = 0; 
                        d.itinerary.forEach(day => {
                            createItineraryRow(dayCount, day);
                            dayCount++;
                        });
                        updateLabelsAndDuration();
                    }
                    
                    // Map Frequently Asked Questions (FAQs)
                    if (d.faqs && Array.isArray(d.faqs) && d.faqs.length > 0) {
                        const faqContainer = document.getElementById('faq-container');
                        faqContainer.innerHTML = ''; 
                        faqCount = 0; 
                        d.faqs.forEach(item => {
                            createFaqRow(faqCount, item);
                            faqCount++;
                        });
                    }

                    // Map Operating Departure Dates & Sanitized Price Tiers
                    if (d.availability && Array.isArray(d.availability) && d.availability.length > 0) {
                        const availContainer = document.getElementById('availability-container');
                        availContainer.innerHTML = ''; 
                        availCount = 0; 
                        d.availability.forEach(item => {
                            createAvailRow(availCount, item);
                            availCount++;
                        });
                    }
                    
                    statusEl.innerText = 'Draft ready. Review the itinerary, categories, FAQs and operating dates before saving.';
                } else {
                    statusEl.style.color = '#c5221f';
                    statusEl.innerText = 'The itinerary could not be mapped: ' + (res.data || 'Please verify the format.');
                }
            })
            .catch(err => {
                console.error(err);
                aiBtn.disabled = false;
                aiBtn.style.opacity = '1';
                statusEl.style.color = '#c5221f';
                statusEl.innerText = 'Something interrupted the AI request. Please try again.';
            });
        });
    }
    // --- END AI ASSISTANT JS LOGIC ---

    // PRELOAD DATA PIPELINE INJECTION
    const preloadItinerary = <?php echo wp_json_encode($saved_itinerary); ?>;
    const preloadFaqs      = <?php echo wp_json_encode($saved_faqs); ?>;
    const preloadExtras    = <?php echo wp_json_encode($saved_extras); ?>;
    const preloadAccom     = <?php echo wp_json_encode($saved_accom); ?>;
    
    let preloadAvail = [];
    <?php if ($is_edit): 
        $availability_table = $wpdb->prefix . 'st_tour_availability';
        $availability_post_id = isset($edit_inventory_tour_id) ? absint($edit_inventory_tour_id) : $tour_id;
        $results = $wpdb->get_results($wpdb->prepare("SELECT * FROM $availability_table WHERE post_id = %d ORDER BY check_in ASC", $availability_post_id), ARRAY_A);
        if(!empty($results)){
            $formatted_avail = [];
            foreach($results as $res){
                $formatted_avail[] = [
                    'date'   => date('d/m/Y', $res['check_in']),
                    'quad'   => $res['adult_price'],
                    'triple' => $res['child_price'],
                    'twin'   => $res['infant_price']
                ];
            }
            echo 'preloadAvail = '.json_encode($formatted_avail).';';
        }
    endif; ?>

    if(preloadItinerary && preloadItinerary.length > 0) {
        preloadItinerary.forEach(item => { createItineraryRow(dayCount, item); dayCount++; });
        updateLabelsAndDuration();
    } else if (addDayBtn) { addDayBtn.click(); }

    if(preloadFaqs && preloadFaqs.length > 0) {
        preloadFaqs.forEach(item => { createFaqRow(faqCount, item); faqCount++; });
    }
    if(preloadExtras && preloadExtras.length > 0) {
        preloadExtras.forEach(item => { createExtraRow(extraCount, item); extraCount++; });
    }
    if(preloadAvail && preloadAvail.length > 0) {
        preloadAvail.forEach(item => { createAvailRow(availCount, item); availCount++; });
    } else {
        initDatePickerOnElements(); 
    }
    if(preloadAccom && preloadAccom.length > 0) {
        preloadAccom.forEach(item => { renderPreloadedAccommodation(item); });
    }

    var tripanzaAjaxUrl = '<?php echo esc_url('/api/host/studio/tools'); ?>';
    var tripanzaStatusEl = document.getElementById('tripanza-settings-status');
    var resetPdfBtn = document.getElementById('tripanza-reset-pdf-design');
    var clearCacheBtn = document.getElementById('tripanza-clear-tour-cache');

    function setTripanzaStatus(message, isError) {
        if (!tripanzaStatusEl) return;
        tripanzaStatusEl.textContent = message;
        tripanzaStatusEl.style.color = isError ? '#c5221f' : '#137333';
    }

    if (resetPdfBtn) {
        resetPdfBtn.addEventListener('click', function () {
            var postId = resetPdfBtn.getAttribute('data-post');
            if (!postId || !confirm('Reset this tour\'s PDF design to defaults?')) return;

            setTripanzaStatus('Resetting...', false);
            fetch(tripanzaAjaxUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                body: 'action=tripanza_reset_pdf_design&post_id=' + encodeURIComponent(postId)
            })
            .then(function (response) { return response.json(); })
            .then(function (data) {
                if (data && data.success) {
                    var heightInput = document.getElementById('pdf_page_height');
                    if (heightInput) heightInput.value = '2500';
                    setTripanzaStatus('PDF design reset to defaults.', false);
                } else {
                    setTripanzaStatus((data && data.data) || 'Unable to reset PDF design.', true);
                }
            })
            .catch(function () {
                setTripanzaStatus('Unable to reset PDF design.', true);
            });
        });
    }

    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', function () {
            var postId = clearCacheBtn.getAttribute('data-post');
            if (!postId || !confirm('Clear this tour\'s cached PDF/images?')) return;

            setTripanzaStatus('Clearing cache...', false);
            fetch(tripanzaAjaxUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                body: 'action=tripanza_clear_tour_cache&post_id=' + encodeURIComponent(postId)
            })
            .then(function (response) { return response.json(); })
            .then(function (data) {
                if (data && data.success) {
                    setTripanzaStatus(data.data || 'Tour cache cleared.', false);
                } else {
                    setTripanzaStatus((data && data.data) || 'Unable to clear cache.', true);
                }
            })
            .catch(function () {
                setTripanzaStatus('Unable to clear cache.', true);
            });
        });
    }

    const tripBuilderForm = document.getElementById('tripanza-tour-builder-form');
    const tripBuilderSubmit = document.getElementById('tripanza-tour-submit');

    if (tripBuilderForm && tripBuilderSubmit) {
        tripBuilderForm.addEventListener('submit', function () {
            tripBuilderSubmit.disabled = true;
            tripBuilderSubmit.setAttribute('aria-busy', 'true');
            const label = tripBuilderSubmit.querySelector('span');
            if (label) label.textContent = 'Saving your trip...';
        });
    }
});
</script>
