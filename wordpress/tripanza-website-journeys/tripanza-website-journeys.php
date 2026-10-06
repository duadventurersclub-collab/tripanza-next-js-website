<?php
/**
 * Plugin Name: Tripanza Website Journeys
 * Description: Consent-aware website follow-up queue for the existing QR-linked WhatsApp bot.
 * Version: 0.2.1
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) exit;

function tpj_table() {
    global $wpdb;
    return $wpdb->prefix . 'tripanza_website_journeys';
}

function tpj_activate() {
    global $wpdb;
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    $table = tpj_table();
    $charset_collate = $wpdb->get_charset_collate();
    dbDelta("CREATE TABLE {$table} (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        visitor_id varchar(36) NOT NULL,
        phone varchar(15) NOT NULL DEFAULT '',
        email varchar(254) NOT NULL DEFAULT '',
        consent_at datetime DEFAULT NULL,
        consent_source varchar(40) NOT NULL DEFAULT '',
        tour_id bigint(20) unsigned NOT NULL DEFAULT 0,
        last_event varchar(40) NOT NULL DEFAULT '',
        last_view_at datetime DEFAULT NULL,
        view_count int(10) unsigned NOT NULL DEFAULT 0,
        due_at datetime DEFAULT NULL,
        last_sent_at datetime DEFAULT NULL,
        sent_count int(10) unsigned NOT NULL DEFAULT 0,
        opted_out tinyint(1) NOT NULL DEFAULT 0,
        converted tinyint(1) NOT NULL DEFAULT 0,
        PRIMARY KEY  (id),
        UNIQUE KEY visitor_id (visitor_id),
        KEY phone (phone),
        KEY due_at (due_at)
    ) {$charset_collate};");
    if (!wp_next_scheduled('tpj_process_due')) wp_schedule_event(time() + 300, 'tpj_five_minutes', 'tpj_process_due');
}
register_activation_hook(__FILE__, 'tpj_activate');
register_deactivation_hook(__FILE__, function () { wp_clear_scheduled_hook('tpj_process_due'); });
add_filter('cron_schedules', function ($schedules) {
    $schedules['tpj_five_minutes'] = ['interval' => 300, 'display' => 'Every five minutes'];
    return $schedules;
});
add_action('tpj_process_due', 'tpj_process_due');

function tpj_phone($value) {
    $digits = preg_replace('/\D+/', '', (string) $value);
    if (strlen($digits) === 10) $digits = '91' . $digits;
    return preg_match('/^[1-9][0-9]{10,14}$/D', $digits) ? $digits : '';
}

function tpj_browser_id($create = false) {
    $visitor = isset($_COOKIE['tripanza_journey']) ? sanitize_text_field(wp_unslash($_COOKIE['tripanza_journey'])) : '';
    if (preg_match('/^[a-f0-9-]{36}$/i', $visitor)) return $visitor;
    if (!$create) return '';
    $visitor = wp_generate_uuid4();
    if (!headers_sent()) {
        setcookie('tripanza_journey', $visitor, [
            'expires' => time() + 90 * DAY_IN_SECONDS,
            'path' => '/',
            'secure' => is_ssl(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }
    $_COOKIE['tripanza_journey'] = $visitor;
    return $visitor;
}

// The native WordPress site writes to the same queue without exposing the
// server-to-server secret used by Next.js. The nonce and same-origin AJAX route
// are for CSRF protection; phone ownership is still not proven for guest forms.
add_action('wp_ajax_tpj_web_event', 'tpj_web_event');
add_action('wp_ajax_nopriv_tpj_web_event', 'tpj_web_event');
function tpj_web_event() {
    if (!check_ajax_referer('tpj_web_event', 'nonce', false)) wp_send_json_error(['message' => 'The form expired. Reload and try again.'], 403);
    $event = isset($_POST['event']) ? sanitize_key(wp_unslash($_POST['event'])) : '';
    if (!in_array($event, ['consent', 'itinerary_downloaded', 'checkout_started', 'cart_created', 'tour_view', 'withdraw'], true)) wp_send_json_error(['message' => 'Invalid event.'], 400);
    $source = isset($_POST['source']) ? sanitize_key(wp_unslash($_POST['source'])) : '';
    if ($event === 'consent' && (!in_array($source, ['signup', 'itinerary', 'checkout'], true) || (string) ($_POST['consent'] ?? '') !== '1')) wp_send_json_error(['message' => 'Consent is required.'], 400);
    if ($event === 'consent' && $source === 'signup') {
        $user_id = get_current_user_id();
        $submitted_phone = tpj_phone(isset($_POST['phone']) ? wp_unslash($_POST['phone']) : '');
        $account_phone = $user_id ? tpj_phone(get_user_meta($user_id, 'st_phone', true) ?: get_user_meta($user_id, 'billing_phone', true)) : '';
        $verified_here = $user_id && $submitted_phone && function_exists('sol_contact_is_verified')
            && sol_contact_is_verified($user_id, 'whatsapp', $submitted_phone);
        if (!$user_id || !$submitted_phone || ($submitted_phone !== $account_phone && !$verified_here)) wp_send_json_error(['message' => 'Sign in with this number before enabling WhatsApp follow-ups.'], 403);
    }
    $visitor = tpj_browser_id($event === 'consent');
    if (!$visitor) wp_send_json_success(['ok' => true]);
    $request = new WP_REST_Request('POST', '/tripanza-journey/v1/event');
    foreach (['event', 'phone', 'email', 'source', 'tour_id'] as $key) {
        if (isset($_POST[$key]) && is_scalar($_POST[$key])) $request->set_param($key, sanitize_text_field(wp_unslash($_POST[$key])));
    }
    if ($event === 'consent' && $source === 'signup') $request->set_param('email', wp_get_current_user()->user_email);
    $request->set_param('visitor_id', $visitor);
    $result = tpj_record_event($request);
    if (is_wp_error($result)) {
        $error_data = $result->get_error_data();
        $status = is_array($error_data) && isset($error_data['status']) ? (int) $error_data['status'] : 400;
        wp_send_json_error(['message' => $result->get_error_message()], $status);
    }
    wp_send_json_success(['ok' => true]);
}

add_action('wp_enqueue_scripts', function () {
    if (is_admin()) return;
    $cart_tour_id = 0;
    $traveler = function_exists('st') ? st() : null;
    $traveler_checkout_id = is_object($traveler) && is_callable([$traveler, 'get_option']) ? absint($traveler->get_option('page_checkout', 0)) : 0;
    $is_booking_page = is_page('cart') || is_page('checkout') || ($traveler_checkout_id && is_page($traveler_checkout_id));
    if ($is_booking_page && class_exists('STCart') && is_callable(['STCart', 'get_carts'])) {
        $carts = STCart::get_carts();
        if (is_array($carts)) foreach (array_keys($carts) as $id) {
            if (is_numeric($id) && get_post_type(absint($id)) === 'st_tours') { $cart_tour_id = absint($id); break; }
        }
    }
    $tour_id = is_singular('st_tours') ? get_queried_object_id() : 0;
    $asset = plugin_dir_path(__FILE__) . 'native-journey.js';
    wp_enqueue_script('tripanza-website-journey', plugins_url('native-journey.js', __FILE__), [], filemtime($asset), true);
    wp_enqueue_style('tripanza-website-journey', plugins_url('native-journey.css', __FILE__), [], filemtime(plugin_dir_path(__FILE__) . 'native-journey.css'));
    wp_add_inline_script('tripanza-website-journey', 'window.TPJ_WEB = ' . wp_json_encode([
        'ajaxUrl' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('tpj_web_event'),
        'tourId' => absint($tour_id),
        'cartTourId' => $cart_tour_id,
    ]) . ';', 'before');
});

// Registration forms that submit this unchecked field may enroll only after
// WordPress actually creates the account. No number is enrolled from a failed
// signup or merely because it was entered into a profile.
add_action('user_register', function ($user_id) {
    if ((string) ($_POST['tpj_followups'] ?? '') !== '1') return;
    $visitor = tpj_browser_id(true);
    add_action('shutdown', function () use ($user_id, $visitor) {
        $phone = get_user_meta($user_id, 'st_phone', true) ?: get_user_meta($user_id, 'billing_phone', true);
        if (!$phone && isset($_POST['phone'])) $phone = sanitize_text_field(wp_unslash($_POST['phone']));
        if (!$phone && isset($_POST['st_phone'])) $phone = sanitize_text_field(wp_unslash($_POST['st_phone']));
        if (!tpj_phone($phone)) return;
        $user = get_userdata($user_id);
        $request = new WP_REST_Request('POST', '/tripanza-journey/v1/event');
        foreach (['visitor_id' => $visitor, 'event' => 'consent', 'source' => 'signup', 'phone' => $phone, 'email' => $user ? $user->user_email : ''] as $key => $value) $request->set_param($key, $value);
        tpj_record_event($request);
    });
}, 30);

add_action('rest_api_init', function () {
    register_rest_route('tripanza-journey/v1', '/event', [
        'methods' => 'POST',
        'permission_callback' => function ($request) {
            $secret = defined('TRIPANZA_JOURNEY_SECRET') ? (string) TRIPANZA_JOURNEY_SECRET : '';
            $provided = (string) $request->get_header('X-Tripanza-Journey-Secret');
            return $secret !== '' && $provided !== '' && hash_equals($secret, $provided);
        },
        'callback' => 'tpj_record_event',
    ]);
});

function tpj_record_event($request) {
    global $wpdb;
    $visitor = sanitize_text_field((string) $request->get_param('visitor_id'));
    $event = sanitize_key((string) $request->get_param('event'));
    if (!preg_match('/^[a-f0-9-]{36}$/i', $visitor) || !in_array($event, ['consent', 'itinerary_downloaded', 'checkout_started', 'cart_created', 'tour_view', 'booking_created', 'withdraw', 'opt_out'], true)) {
        return new WP_Error('tpj_invalid_event', 'Invalid journey event.', ['status' => 400]);
    }
    $table = tpj_table();
    $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE visitor_id = %s", $visitor));
    $now = current_time('mysql');
    $tour_id = absint($request->get_param('tour_id'));
    if ($event === 'consent') {
        $phone = tpj_phone($request->get_param('phone'));
        $email = sanitize_email((string) $request->get_param('email'));
        $source = sanitize_key((string) $request->get_param('source'));
        if (!$phone || !in_array($source, ['signup', 'itinerary', 'checkout'], true)) return new WP_Error('tpj_invalid_consent', 'Invalid consent details.', ['status' => 400]);
        // A STOP or previous website opt-out applies to the number, not just one browser.
        $previous_optout = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$table} WHERE phone = %s AND opted_out = 1", $phone));
        if ($previous_optout || ($row && $row->opted_out)) return new WP_Error('tpj_opted_out', 'This number is opted out.', ['status' => 409]);
        if (!$row || $row->phone !== $phone) {
            $rate_key = 'tpj_consent_' . hash('sha256', $phone);
            $attempts = (int) get_transient($rate_key);
            if ($attempts >= 3) return new WP_Error('tpj_consent_rate', 'Too many requests for this number.', ['status' => 429]);
            set_transient($rate_key, $attempts + 1, HOUR_IN_SECONDS);
        }
        $data = ['phone' => $phone, 'email' => $email, 'consent_at' => $now, 'consent_source' => $source];
        if (get_transient('tpj_booked_' . hash('sha256', $phone))) $data['converted'] = 1;
        if ($row && $row->phone !== $phone) $data += ['due_at' => null, 'last_event' => '', 'tour_id' => 0];
        if ($row) $wpdb->update($table, $data, ['id' => $row->id]);
        else $wpdb->insert($table, ['visitor_id' => $visitor] + $data);
        return ['ok' => true];
    }
    if (!$row) return new WP_Error('tpj_unknown_visitor', 'No journey was found.', ['status' => 404]);
    if ($event === 'withdraw') {
        $wpdb->update($table, ['consent_at' => null, 'due_at' => null], ['id' => $row->id]);
        return ['ok' => true];
    }
    if ($event === 'opt_out') {
        $wpdb->update($table, ['opted_out' => 1, 'due_at' => null], ['phone' => $row->phone]);
        return ['ok' => true];
    }
    if ($event === 'booking_created') {
        $phone = tpj_phone($request->get_param('phone')) ?: $row->phone;
        if ($phone) {
            set_transient('tpj_booked_' . hash('sha256', $phone), 1, DAY_IN_SECONDS);
            $wpdb->update($table, ['converted' => 1, 'due_at' => null], ['phone' => $phone]);
        }
        return ['ok' => true];
    }
    if (!$row->consent_at || $row->opted_out || $row->converted) return ['ok' => true];
    if ($event === 'tour_view') {
        $wpdb->update($table, [
            'last_view_at' => $now,
            'view_count' => min(100000, (int) $row->view_count + 1),
            'tour_id' => $tour_id && get_post_type($tour_id) === 'st_tours' ? $tour_id : (int) $row->tour_id,
        ], ['id' => $row->id]);
        return ['ok' => true];
    }
    $data = ['last_event' => $event];
    if ($tour_id && get_post_type($tour_id) === 'st_tours') $data['tour_id'] = $tour_id;
    if ($event === 'checkout_started' || $event === 'cart_created') $data['due_at'] = wp_date('Y-m-d H:i:s', time() + HOUR_IN_SECONDS);
    if ($event === 'itinerary_downloaded' && !in_array($row->last_event, ['checkout_started', 'cart_created'], true)) $data['due_at'] = wp_date('Y-m-d H:i:s', time() + 6 * HOUR_IN_SECONDS);
    $wpdb->update($table, $data, ['id' => $row->id]);
    return ['ok' => true];
}

// All Traveler booking paths call this hook; suppress pending outreach even when
// the order was created outside the Next.js checkout.
function tpj_mark_booked_phone($phone) {
    global $wpdb;
    $phone = tpj_phone($phone);
    if ($phone) {
        set_transient('tpj_booked_' . hash('sha256', $phone), 1, DAY_IN_SECONDS);
        $wpdb->update(tpj_table(), ['converted' => 1, 'due_at' => null], ['phone' => $phone]);
    }
}
add_action('st_booking_created', function ($booking_id) {
    tpj_mark_booked_phone(get_post_meta(absint($booking_id), 'st_phone', true));
}, 20);
foreach (['added_post_meta', 'updated_post_meta'] as $hook) add_action($hook, function ($meta_id, $post_id, $meta_key, $value) {
    if ($meta_key === 'st_phone' && get_post_type($post_id) === 'st_order') tpj_mark_booked_phone($value);
}, 20, 4);

function tpj_process_due() {
    // Deployment never begins sending marketing automatically.
    if (!defined('TRIPANZA_JOURNEY_SEND_ENABLED') || TRIPANZA_JOURNEY_SEND_ENABLED !== true) return;
    $bot = defined('TRIPANZA_WHATSAPP_BOT_URL') ? untrailingslashit((string) TRIPANZA_WHATSAPP_BOT_URL) : '';
    $key = defined('TRIPANZA_WHATSAPP_API_KEY') ? (string) TRIPANZA_WHATSAPP_API_KEY : '';
    if (!$bot || !$key || wp_parse_url($bot, PHP_URL_SCHEME) !== 'https' || !wp_http_validate_url($bot)) return;
    $hour = (int) current_time('G');
    if ($hour < 10 || $hour >= 19) return;
    if (get_transient('tpj_worker_lock')) return;
    set_transient('tpj_worker_lock', 1, 120);
    global $wpdb;
    $table = tpj_table();
    $rows = $wpdb->get_results($wpdb->prepare("SELECT * FROM {$table} WHERE due_at IS NOT NULL AND due_at <= %s AND consent_at IS NOT NULL AND opted_out = 0 AND converted = 0 ORDER BY due_at ASC LIMIT 10", current_time('mysql')));
    foreach ($rows as $row) {
        $muted = (array) get_option('whatsapp_ai_muted_phones', []);
        $phone = $row->phone;
        $other_sent = $wpdb->get_var($wpdb->prepare("SELECT MAX(last_sent_at) FROM {$table} WHERE phone = %s", $phone));
        $last_sent_date = $other_sent ? DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $other_sent, wp_timezone()) : false;
        $recent = $last_sent_date && $last_sent_date->getTimestamp() > time() - DAY_IN_SECONDS;
        $total_sent = (int) $wpdb->get_var($wpdb->prepare("SELECT SUM(sent_count) FROM {$table} WHERE phone = %s", $phone));
        $opted_out = $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$table} WHERE phone = %s AND opted_out = 1", $phone));
        $muted_numbers = array_map('tpj_phone', array_keys($muted));
        $crm_table = $wpdb->prefix . 'itinerary_crm';
        $crm_optout = false;
        if ($wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $wpdb->esc_like($crm_table))) === $crm_table) {
            $crm_optout = (bool) $wpdb->get_var($wpdb->prepare(
                "SELECT id FROM {$crm_table} WHERE (customer_phone = %s OR whatsapp_number = %s) AND status = 'Unsubscribed' LIMIT 1",
                $phone, $phone
            ));
        }
        if (!$phone || $opted_out || $crm_optout || in_array($phone, $muted_numbers, true) || $recent || $total_sent >= 2) {
            $wpdb->update($table, ['due_at' => null], ['id' => $row->id]);
            continue;
        }
        $retry_at = wp_date('Y-m-d H:i:s', time() + HOUR_IN_SECONDS);
        $claimed = $wpdb->update($table, ['due_at' => $retry_at], ['id' => $row->id, 'due_at' => $row->due_at]);
        if ($claimed !== 1) continue;
        $title = $row->tour_id ? wp_strip_all_tags(get_the_title($row->tour_id)) : 'your Tripanza trip';
        $frontend = defined('TRIPANZA_NEXT_APP_URL') ? untrailingslashit((string) TRIPANZA_NEXT_APP_URL) : home_url();
        $link = $row->tour_id ? $frontend . '/tours/' . get_post_field('post_name', $row->tour_id) : $frontend . '/tours';
        $token = hash_hmac('sha256', $row->visitor_id, wp_salt('auth'));
        $stop = add_query_arg(['tpj_stop' => $row->visitor_id, 'token' => $token], home_url('/'));
        $message = $row->last_event === 'itinerary_downloaded'
            ? "Thanks for exploring {$title}. Questions about dates or the itinerary? We're here to help: {$link}"
            : "Still planning {$title}? Your selection is saved for now. See available dates: {$link}";
        $message .= "\n\nStop these updates: {$stop}";
        $response = wp_remote_post($bot . '/api/send', [
            'timeout' => 15,
            'redirection' => 0,
            'headers' => ['Content-Type' => 'application/json'],
            'body' => wp_json_encode(['api_key' => $key, 'bot' => 'crm', 'phone' => $phone, 'message' => $message]),
        ]);
        if (!is_wp_error($response) && wp_remote_retrieve_response_code($response) === 200) {
            $wpdb->update($table, ['due_at' => null, 'last_sent_at' => current_time('mysql'), 'sent_count' => (int) $row->sent_count + 1], ['id' => $row->id]);
        } elseif (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 503) {
            // A timeout may mean delivery succeeded. Avoid a duplicate; inspect manually.
            // Only an explicit "bot disconnected" response is retried in one hour.
            $wpdb->update($table, ['due_at' => null], ['id' => $row->id]);
        }
    }
    delete_transient('tpj_worker_lock');
}

add_action('template_redirect', function () {
    if (!isset($_GET['tpj_stop'], $_GET['token'])) return;
    $visitor = sanitize_text_field(wp_unslash($_GET['tpj_stop']));
    $token = sanitize_text_field(wp_unslash($_GET['token']));
    if (!preg_match('/^[a-f0-9-]{36}$/i', $visitor) || !hash_equals(hash_hmac('sha256', $visitor, wp_salt('auth')), $token)) wp_die('This opt-out link is invalid.', 'Tripanza', ['response' => 400]);
    global $wpdb;
    $phone = $wpdb->get_var($wpdb->prepare('SELECT phone FROM ' . tpj_table() . ' WHERE visitor_id = %s', $visitor));
    if (!$phone) wp_die('This opt-out link is invalid.', 'Tripanza', ['response' => 400]);
    $wpdb->update(tpj_table(), ['opted_out' => 1, 'due_at' => null], ['phone' => $phone]);
    wp_die('You will no longer receive Tripanza website follow-up messages at this number.', 'Tripanza', ['response' => 200]);
});
