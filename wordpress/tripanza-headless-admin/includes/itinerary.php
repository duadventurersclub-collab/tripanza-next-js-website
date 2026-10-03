<?php
defined('ABSPATH') || exit;
function tripanza_native_mail_error($data, $status) { return new WP_Error('tripanza_itinerary_mail', $data['message'], array('status' => $status)); }
function tripanza_native_send_itinerary() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'itinerary_crm';

    $request_nonce = sanitize_text_field(wp_unslash($_POST['security'] ?? ($_POST['nonce'] ?? '')));
    if (!wp_verify_nonce($request_nonce, 'tripanza_itinerary_lead') && !wp_verify_nonce($request_nonce, 'tripanza_send_tour_itinerary')) {
        return tripanza_native_mail_error(['message' => 'The request expired. Refresh and try again.'], 403);
    }

    $post_id         = intval($_POST['post_id']);
    $customer_email  = sanitize_email($_POST['customer_email']);
    $customer_phone  = function_exists('tripanza_crm_normalize_phone')
        ? tripanza_crm_normalize_phone(wp_unslash($_POST['customer_phone'] ?? ''))
        : sanitize_text_field(wp_unslash($_POST['customer_phone'] ?? ''));
    $departure_date  = sanitize_text_field($_POST['departure_date'] ?? '');

    if (empty($customer_email) || empty($post_id) || get_post_type($post_id) !== 'st_tours') {
        return tripanza_native_mail_error(['message' => 'Missing required data (email or post ID)'], 400);
    }
    if ($departure_date !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $departure_date)) {
        return tripanza_native_mail_error(['message' => 'Please choose a valid departure date.'], 400);
    }
    $request_ip = sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
    $rate_key = 'tripanza_itinerary_mail_' . hash('sha256', strtolower($customer_email) . '|' . $request_ip);
    $request_count = (int) get_transient($rate_key);
    if ($request_count >= 5) {
        return tripanza_native_mail_error(['message' => 'Too many requests. Please wait a few minutes and try again.'], 429);
    }
    set_transient($rate_key, $request_count + 1, 10 * MINUTE_IN_SECONDS);

    // Fixed Tripanza company info
    $company_name    = 'Tripanza';
    $company_email   = 'hello@tripanza.com | Tripanza.com@gmail.com';
    $company_phone   = '8130117254';
    $company_logo    = 'https://tripanza.com/wp-content/uploads/2021/03/cropped-Tripanza-Logo-11.png';
    $company_website = 'www.tripanza.com';

// Always build fresh HTML so recipient, dates, pricing and host data are current.
$html_content = build_tour_itinerary_html($post_id, $customer_email, $departure_date);



$title = get_the_title($post_id);

// 1. Decode HTML entities (turns &#8211; back into an actual dash)
$title = html_entity_decode($title, ENT_QUOTES, 'UTF-8');

// 2. Normalize fancy dashes to standard hyphens for perfect email compatibility
$title = str_replace(['–', '—', '−'], '-', $title);

// Set the subject line once
$subject = 'Your Trip Itinerary | ' . $title;

$host_id = get_post_field('post_author', $post_id);
$host_company = get_user_meta($host_id, 'travel_company', true);

if(empty($host_company)){
    $host_company = 'Tripanza';
}

$from_name = $host_company . ' - Tripanza';

add_filter('wp_mail_from_name', function() use ($from_name) {
    return $from_name;
});

add_filter('wp_mail_from', function() {
    return 'no-reply@tripanza.com';
});

$headers = [
    'Content-Type: text/html; charset=UTF-8'
];

$sent = wp_mail($customer_email, $subject, $html_content, $headers);

    // Save CRM record
    $canonical_trip_id = absint(get_post_meta($post_id, 'host_parent_trip_id', true)) ?: $post_id;
    $host_user = $host_id ? get_userdata($host_id) : false;
    $selling_host_id = ($host_user && in_array('partner', (array) $host_user->roles, true)) ? absint($host_id) : 0;
    $identity_key = function_exists('tripanza_crm_resolve_identity_key')
        ? tripanza_crm_resolve_identity_key($customer_email, $customer_phone, true)
        : (function_exists('tripanza_crm_identity_key') ? tripanza_crm_identity_key($customer_email, $customer_phone) : '');
    $crm_saved = $wpdb->insert($table_name, [
        'customer_email'  => $customer_email,
        'customer_phone'  => $customer_phone,
        'itinerary_title' => get_the_title($post_id),
        'sent_on'         => current_time('mysql'),
        'departure_date'  => $departure_date,
        'source'           => 'Itinerary Send',
        'canonical_trip_id'=> $canonical_trip_id,
        'host_id'          => $selling_host_id,
        'customer_identity_key' => $identity_key,
        'last_activity_at'=> current_time('mysql'),
        'next_action_at'   => date('Y-m-d H:i:s', current_time('timestamp') + 2 * HOUR_IN_SECONDS),
        'consent_source'   => 'transactional_itinerary_request',
        'consent_recorded_at' => current_time('mysql'),
    ]);

    if ($sent) {
        return array('message' => $crm_saved === false ? 'Itinerary emailed, but the CRM record could not be saved. Check WordPress CRM storage before sending again.' : 'Itinerary emailed successfully and saved to CRM!', 'crm_saved' => $crm_saved !== false);
    } else {
        return tripanza_native_mail_error(['message' => 'Failed to send email.'], 400);
    }
}
