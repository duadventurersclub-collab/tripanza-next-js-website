<?php
/**
 * Plugin Name: Tripanza Workspace Bridge
 * Description: Connects the WhatsApp workspace to the existing Tripanza itinerary and booking functions.
 * Version: 1.0.0
 */
if (!defined('ABSPATH')) { exit; }

function twb_permission($request) {
    $token = (string) $request->get_header('x-tripanza-workspace-token');
    $hash = get_option('twb_token_hash', '');
    return strlen($token) === 64 && $hash && hash_equals($hash, hash('sha256', $token))
        ? true : new WP_Error('twb_auth', 'Workspace connection key rejected.', ['status' => 401]);
}
function twb_capabilities() {
    return ['version' => 1, 'email' => function_exists('build_tour_itinerary_html'),
        'booking' => function_exists('tripanza_create_tour_booking'), 'site' => home_url('/')];
}
function twb_error($code, $message, $status = 422) { return new WP_Error($code, $message, ['status' => $status]); }
function twb_tour($url) {
    if (!is_string($url) || strlen($url) > 500) { return 0; }
    $site = wp_parse_url(home_url('/')); $parts = wp_parse_url($url);
    if (!$parts || ($parts['host'] ?? '') !== $site['host'] || ($parts['scheme'] ?? '') !== $site['scheme'] || isset($parts['query']) || isset($parts['user']) || isset($parts['fragment'])) { return 0; }
    if (!preg_match('~^/(?:tour|tours)/[a-z0-9-]+/?$~i', $parts['path'] ?? '')) { return 0; }
    $id = url_to_postid($url);
    return $id && get_post_status($id) === 'publish' && get_post_type($id) === 'st_tours' ? $id : 0;
}
function twb_booking_input($data) {
    $tour = twb_tour($data['tour_url'] ?? null);
    $date = $data['date'] ?? '';
    $parsed = is_string($date) ? DateTimeImmutable::createFromFormat('!d/m/Y', $date, wp_timezone()) : false;
    if (!$tour || !$parsed || $parsed->format('d/m/Y') !== $date || $parsed < new DateTimeImmutable('today', wp_timezone())) { return twb_error('twb_details', 'Select a published group tour and a valid future departure.'); }
    foreach (['quad', 'triple', 'twin'] as $field) {
        if (!isset($data[$field]) || !is_int($data[$field]) || $data[$field] < 0 || $data[$field] > 50) { return twb_error('twb_people', 'Invalid sharing counts.'); }
    }
    $pax = $data['quad'] + $data['triple'] + $data['twin'];
    if ($pax < 1 || $pax > 50 || !is_email($data['email'] ?? '') || !preg_match('/^\+?[0-9]{8,15}$/', $data['phone'] ?? '') || empty($data['name']) || strlen($data['name']) > 120) { return twb_error('twb_details', 'Supply name, email, phone and travellers for each sharing type.'); }
    // Only explicit published departures are eligible; private/daily quotes remain inactive.
    $available = false; $seats = get_post_meta($tour, '_seats_availability', true);
    $departure_timestamp = strtotime(str_replace('/', '-', $date));
    if (is_array($seats) && $seats) {
        foreach ($seats as $key => $status) {
            if (strtotime(str_replace('/', '-', $key)) === $departure_timestamp && !in_array((string) $status, ['0', '00', '5'], true)) { $available = true; break; }
        }
    } else {
        global $wpdb;
        $table = $wpdb->prefix . 'st_tour_availability';
        if ($wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $table)) === $table) {
            $available = $wpdb->get_var($wpdb->prepare("SELECT status FROM {$table} WHERE post_id = %d AND check_in = %d LIMIT 1", $tour, $departure_timestamp)) === 'available';
        }
    }
    if (!$available) { return twb_error('twb_unavailable', 'This departure cannot currently be booked. Ask the team to check availability.'); }
    $subtotal = 0;
    foreach (['quad' => 'adult_price', 'triple' => 'child_price', 'twin' => 'infant_price'] as $sharing => $meta) {
        $price = (float) preg_replace('/[^0-9.\-]/', '', (string) get_post_meta($tour, $meta, true));
        if ($data[$sharing] && $price <= 0) { return twb_error('twb_price', 'A sharing price is unavailable. Ask the team for a quote.'); }
        $subtotal += $price * $data[$sharing];
    }
    $discount = (float) get_post_meta($tour, 'discount_rate', true);
    if ($discount > 0) { $subtotal -= get_post_meta($tour, 'discount_type', true) === 'amount' ? $discount * $pax : $subtotal * $discount / 100; }
    $tax = class_exists('STPrice') ? (float) STPrice::getTax() : 0;
    $total = round($subtotal * (1 + $tax / 100), 2);
    $deposit = (float) get_post_meta($tour, 'deposit_payment_amount', true);
    if ($deposit <= 0) { $deposit = 100; }
    if ($deposit > 100 || $total <= 0 || !is_finite($total)) { return twb_error('twb_price', 'Pricing needs a team check.'); }
    return ['tour_id' => $tour, 'title' => get_the_title($tour), 'total' => $total, 'advance' => round($total * $deposit / 100, 2), 'currency' => 'INR', 'travellers' => $pax,
        'note' => 'Order advance before any payment-gateway fee. Excluded trip costs remain payable separately. Booking and seats require payment and team confirmation.'];
}
function twb_quote($request) {
    if (!function_exists('tripanza_create_tour_booking')) { return twb_error('twb_dependency', 'Activate the existing Tripanza WhatsApp AI CRM plugin first.'); }
    return twb_booking_input($request->get_json_params() ?: []);
}
function twb_action($request) {
    $data = $request->get_json_params() ?: []; $kind = $data['kind'] ?? '';
    $key = $data['request_id'] ?? '';
    if (!is_string($key) || !preg_match('/^[a-f0-9]{64}$/', $key) || !in_array($kind, ['email', 'booking'], true)) { return twb_error('twb_request', 'Invalid action request.'); }
    $option = 'twb_request_' . $key; $existing = get_option($option, false);
    $fingerprint = hash('sha256', wp_json_encode($data));
    if ($existing !== false) {
        if (($existing['fingerprint'] ?? '') !== $fingerprint) { return twb_error('twb_conflict', 'Request details changed.', 409); }
        return $existing['result'] ?? twb_error('twb_pending', 'Action outcome requires a team check. Do not retry with a new request ID.', 409);
    }
    $tour = twb_tour($data['tour_url'] ?? null);
    if (!$tour || !is_email($data['email'] ?? '') || !preg_match('/^\+?[0-9]{8,15}$/', $data['phone'] ?? '')) { return twb_error('twb_details', 'Invalid tour or contact details.'); }
    if ($kind === 'email' && !function_exists('build_tour_itinerary_html') || $kind === 'booking' && !function_exists('tripanza_create_tour_booking')) { return twb_error('twb_dependency', 'The reference Tripanza plugin is not ready.'); }
    $quote = $kind === 'booking' ? twb_booking_input($data) : null;
    if (is_wp_error($quote)) { return $quote; }
    if ($kind === 'booking' && (!isset($data['expected_total'], $data['expected_advance']) || abs($quote['total'] - $data['expected_total']) > 0.01 || abs($quote['advance'] - $data['expected_advance']) > 0.01)) { return twb_error('twb_changed', 'Price changed. Review a fresh quote before confirming.', 409); }
    // Atomic insert: never release an uncertain reservation after a crash/timeout.
    if (!add_option($option, ['fingerprint' => $fingerprint, 'created_at' => time()], '', false)) { return twb_error('twb_pending', 'This request is already processing.', 409); }
    try {
        if ($kind === 'email') {
            $html = build_tour_itinerary_html($tour);
            if (!is_string($html) || !trim($html)) { throw new RuntimeException('Missing itinerary'); }
            $accepted = wp_mail($data['email'], "Your Tripanza itinerary: " . get_the_title($tour), $html, ['Content-Type: text/html; charset=UTF-8']);
            $result = ['success' => (bool) $accepted, 'kind' => 'email', 'email' => $data['email'], 'title' => get_the_title($tour), 'status' => $accepted ? 'accepted' : 'failed'];
            if ($accepted && function_exists('tripanza_create_or_update_crm_lead')) {
                try { tripanza_create_or_update_crm_lead($data['phone'], $data['email'], get_the_title($tour), 'Workspace itinerary email'); } catch (Throwable $ignored) { /* The mail receipt must survive an optional CRM failure. */ }
            }
        } else {
            $names = preg_split('/\s+/', trim(sanitize_text_field($data['name'])), 2);
            // The reference uses adults/children/infants for QUAD/TRIPLE/TWIN traveller counts.
            $order = tripanza_create_tour_booking($tour, $names[0], $names[1] ?? '', $data['email'], $data['phone'], $data['date'], $data['quad'], $data['triple'], $data['twin']);
            if (!$order || is_wp_error($order)) { $result = ['success' => false, 'kind' => 'booking', 'status' => 'failed']; }
            else {
                update_post_meta($order, '_twb_request_id', $key);
                $prices = get_post_meta($order, 'data_prices', true);
                $result = ['success' => true, 'kind' => 'booking', 'order_id' => (string) $order, 'status' => 'pending_payment',
                    'total' => (float) ($prices['total_price_with_tax'] ?? $quote['total']), 'advance' => (float) get_post_meta($order, 'total_price', true), 'currency' => 'INR',
                    'payu_url' => home_url('/advance-payu-payment/?order_id=' . $order), 'upi_url' => home_url('/advance-upi-payment?order_id=' . $order)];
            }
        }
        update_option($option, ['fingerprint' => $fingerprint, 'result' => $result, 'created_at' => time()], false);
        return $result;
    } catch (Throwable $error) { return twb_error('twb_uncertain', 'Action outcome requires a team check. Do not repeat this action with a new request ID.', 409); }
}
add_action('rest_api_init', function () {
    foreach (['capabilities' => ['GET', 'twb_capabilities'], 'quote' => ['POST', 'twb_quote'], 'actions' => ['POST', 'twb_action']] as $path => $route) {
        register_rest_route('tripanza-workspace/v1', '/' . $path, ['methods' => $route[0], 'callback' => $route[1], 'permission_callback' => 'twb_permission']);
    }
});
add_action('admin_menu', function () { add_options_page('Tripanza Workspace', 'Tripanza Workspace', 'manage_options', 'tripanza-workspace', 'twb_settings'); });
function twb_settings() {
    if (!current_user_can('manage_options')) { return; }
    $token = '';
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        check_admin_referer('twb_key');
        $token = bin2hex(random_bytes(32)); update_option('twb_token_hash', hash('sha256', $token), false);
    }
    echo '<div class="wrap"><h1>Tripanza Workspace</h1><p>Keep your existing Tripanza WhatsApp AI CRM plugin active. Copy the connection key into the workspace AI chatbot settings. Generating a new key revokes the previous key.</p>';
    if ($token) { echo '<p><strong>Copy this key now (shown once):</strong></p><input readonly type="text" style="width:650px;max-width:100%" value="' . esc_attr($token) . '">'; }
    $caps = twb_capabilities();
    echo '<p>Itinerary email: ' . ($caps['email'] ? 'Ready' : 'Missing itinerary renderer') . '. Booking: ' . ($caps['booking'] ? 'Ready' : 'Missing reference booking function') . '.</p><form method="post">';
    wp_nonce_field('twb_key'); submit_button('Generate connection key'); echo '</form></div>';
}
