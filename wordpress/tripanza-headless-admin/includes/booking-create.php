<?php
// Native admin creation adapter for tripanza-create-edit-new-booking.php.
// Does not include a page template or replace the existing standard-booking function.
defined('ABSPATH') || exit;

function tripanza_native_create_template_id() { return absint(apply_filters('tripanza_native_custom_booking_template_id', 27807)); }
function tripanza_native_create_template_exists() { return (bool) get_post(tripanza_native_create_template_id()); }
function tripanza_native_create_tours() {
    $authors = get_users(array('role__in' => array('administrator'), 'fields' => 'ID'));
    return get_posts(array('post_type' => 'st_tours', 'post_status' => array('publish', 'private'), 'posts_per_page' => -1, 'author__in' => $authors ?: array(1), 'orderby' => 'title', 'order' => 'ASC'));
}
function tripanza_native_create_storage_ready() {
    global $wpdb; $table = $wpdb->prefix . 'st_order_item_meta';
    return post_type_exists('st_order') && $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $wpdb->esc_like($table))) === $table;
}
function tripanza_native_create_prerequisites() {
    global $wpdb; $table = $wpdb->prefix . 'st_order_item_meta';
    return array('template_exists' => tripanza_native_create_template_exists(), 'order_type_available' => post_type_exists('st_order'),
        'traveler_table_available' => $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $wpdb->esc_like($table))) === $table);
}
function tripanza_native_create_get() {
    $prerequisites = tripanza_native_create_prerequisites();
    return tripanza_native_admin_response(array('create_api_version' => '1.0.0', 'user' => array('name' => wp_get_current_user()->display_name), 'nonce' => wp_create_nonce('tripanza_native_booking_create'), 'today' => current_time('Y-m-d'),
        'tours' => array_map(function ($tour) { return array('id' => (int) $tour->ID, 'name' => html_entity_decode(get_the_title($tour->ID), ENT_QUOTES, 'UTF-8')); }, tripanza_native_create_tours()),
        'standard_available' => $prerequisites['order_type_available'] && $prerequisites['traveler_table_available'] && function_exists('tripanza_create_tour_booking'),
        'custom_available' => !in_array(false, $prerequisites, true), 'custom_prerequisites' => $prerequisites,
        'custom_template_id' => tripanza_native_create_template_id(), 'mail_available' => is_callable(array('STCart', 'send_mail_after_booking'))));
}
function tripanza_native_create_validate($data) {
    if (!is_array($data) || !in_array($data['mode'] ?? '', array('standard', 'custom'), true) || !isset($data['fields']) || !is_array($data['fields'])) return tripanza_native_admin_error('Choose a valid booking type.', 422);
    $input = $data['fields']; $fields = array();
    foreach (array('first_name', 'last_name', 'email', 'phone', 'custom_package_name', 'duration', 'boarding', 'dropoff') as $key) {
        $value = $input[$key] ?? ''; if (!is_string($value) || strlen($value) > ($key === 'email' ? 254 : 600)) return tripanza_native_admin_error('Invalid ' . str_replace('_', ' ', $key) . '.', 422);
        $fields[$key] = $key === 'email' ? sanitize_email($value) : sanitize_text_field($value);
    }
    if ($fields['first_name'] === '' || !is_email($fields['email']) || !preg_match('/^\+?[0-9\s().-]+$/D', $fields['phone']) || strlen(preg_replace('/\D+/', '', $fields['phone'])) < 7 || strlen(preg_replace('/\D+/', '', $fields['phone'])) > 15) return tripanza_native_admin_error('Enter a first name, valid email and phone number.', 422);
    foreach (array('adults', 'children', 'infants', 'balance_due_days', 'selected_tour_id') as $key) {
        $value = $input[$key] ?? 0;
        if ((!is_int($value) && !is_string($value)) || !ctype_digit((string) $value) || (float) $value > ($key === 'selected_tour_id' ? PHP_INT_MAX : 5000)) return tripanza_native_admin_error('Occupancy and balance due days must be whole, non-negative numbers.', 422);
        $fields[$key] = (int) $value;
    }
    $pax = $fields['adults'] + $fields['children'] + $fields['infants'];
    if ($pax < 1 || $pax > 5000) return tripanza_native_admin_error('Choose between 1 and 5000 travellers.', 422);
    foreach (array('check_in', 'check_out') as $key) {
        $value = $input[$key] ?? '';
        if (!is_string($value) || ($value === '' ? $key === 'check_in' || $data['mode'] === 'custom' : !tripanza_native_admin_valid_date($value))) return tripanza_native_admin_error('Enter valid travel dates.', 422);
        $fields[$key] = $value;
    }
    if ($data['mode'] === 'custom' && ($fields['check_out'] < $fields['check_in'] || $fields['duration'] === '' || $fields['custom_package_name'] === '')) return tripanza_native_admin_error('Enter the package name, duration and an end date on or after the start date.', 422);
    $fields['guests'] = array();
    if (!isset($input['guests']) || !is_array($input['guests']) || count($input['guests']) > 100) return tripanza_native_admin_error('Invalid traveller list.', 422);
    foreach ($input['guests'] as $guest) {
        if (!is_array($guest) || !isset($guest['name'], $guest['title']) || !is_string($guest['name']) || strlen($guest['name']) > 600 || !in_array($guest['title'], array('mr', 'miss'), true)) return tripanza_native_admin_error('Enter valid traveller names and titles.', 422);
        $name = sanitize_text_field($guest['name']); if ($name !== '') $fields['guests'][] = array('name' => $name, 'title' => $guest['title']);
    }
    if ($data['mode'] === 'standard') {
        $allowed = array_map(function ($tour) { return (int) $tour->ID; }, tripanza_native_create_tours());
        if (!in_array($fields['selected_tour_id'], $allowed, true)) return tripanza_native_admin_error('Select an available admin tour.', 422);
        if (!function_exists('tripanza_create_tour_booking')) return tripanza_native_admin_error('The existing tripanza_create_tour_booking function is unavailable.', 503);
    } else {
        // The original manager copies metadata from post #27807 without
        // requiring that source post to be a tour. The new post is the tour.
        if (!tripanza_native_create_template_exists()) return tripanza_native_admin_error('The custom booking metadata source post is unavailable.', 503);
        foreach (array('quad_price', 'triple_price', 'twin_price') as $key) { $fields[$key] = tripanza_native_editor_money_input($input[$key] ?? null); if ($fields[$key] === false) return tripanza_native_admin_error('Enter valid sharing prices with at most two decimal places.', 422); }
        $fields['custom_total'] = round($fields['adults'] * $fields['quad_price'] + $fields['children'] * $fields['triple_price'] + $fields['infants'] * $fields['twin_price'], 2);
        if ($fields['custom_total'] <= 0 || $fields['custom_total'] > 100000000) return tripanza_native_admin_error('Enter a positive package total below 100,000,000.', 422);
        // Blank has the reference's full-advance default; explicitly entered 0 stays 0.
        $advance = $input['advance_payment'] ?? ''; $fields['advance_payment'] = $advance === '' ? $fields['custom_total'] : tripanza_native_editor_money_input($advance);
        if ($fields['advance_payment'] === false || $fields['advance_payment'] > $fields['custom_total']) return tripanza_native_admin_error('Advance must be between zero and the package total.', 422);
    }
    return $fields;
}
function tripanza_native_create_guest_data($guests) {
    $names = array(); $titles = array(); $adults = array();
    foreach ($guests as $guest) { $names[] = $guest['name']; $titles[] = $guest['title']; $parts = preg_split('/\s+/', trim($guest['name']), 2); $adults[] = array('first_name' => $parts[0] ?? '', 'last_name' => $parts[1] ?? '', 'title' => $guest['title']); }
    return array('guest_name' => $names, 'guest_title' => $titles, 'adult' => $adults);
}
function tripanza_native_create_apply_guests($id, $fields) {
    if (!$fields['guests']) return; // Preserve standard function's generated guests when no names were entered.
    $guest_data = tripanza_native_create_guest_data($fields['guests']);
    foreach (array('guest_name', 'guest_title') as $key) tripanza_native_editor_meta_write($id, $key, $guest_data[$key]);
    $raw = get_post_meta($id, 'raw_data', true); $raw = is_array($raw) ? $raw : json_decode((string) $raw, true);
    if (is_array($raw)) tripanza_native_editor_meta_write($id, 'raw_data', wp_json_encode(array_replace($raw, $guest_data)));
    $item = get_post_meta($id, 'item_data', true); if (is_array($item)) tripanza_native_editor_meta_write($id, 'item_data', array_replace($item, $guest_data));
    $tour = absint(get_post_meta($id, 'item_id', true)); $cart = get_post_meta($id, 'st_cart_info', true);
    if (is_array($cart) && isset($cart[$tour]['data']) && is_array($cart[$tour]['data'])) { $cart[$tour]['data'] = array_replace($cart[$tour]['data'], $guest_data); tripanza_native_editor_meta_write($id, 'st_cart_info', $cart); }
}
function tripanza_native_create_response($id, $mode, $warning = '') {
    return array('ok' => true, 'order_id' => (int) $id, 'message' => $mode === 'custom' ? 'Custom package booking successfully generated!' : 'Standard booking successfully generated!', 'warning' => $warning);
}
function tripanza_native_create_mark($id, $key, $hash) {
    tripanza_native_editor_meta_write($id, '_tripanza_native_create_key', $key);
    tripanza_native_editor_meta_write($id, '_tripanza_native_create_hash', $hash);
}
function tripanza_native_create_custom($fields, $key, $hash) {
    global $wpdb;
    $started = tripanza_native_editor_begin(); if (is_wp_error($started)) return $started;
    $shadow = 0; $id = 0;
    try {
        $title = 'Customized Trip - ' . $fields['custom_package_name'];
        $shadow = wp_insert_post(array('post_title' => $title, 'post_type' => 'st_tours', 'post_status' => 'private', 'post_author' => get_current_user_id()), true);
        if (is_wp_error($shadow) || !$shadow) throw new RuntimeException('Private invoice tour creation failed.');
        foreach ((array) get_post_meta(tripanza_native_create_template_id()) as $meta_key => $values) foreach ((array) $values as $value) if (add_post_meta($shadow, $meta_key, wp_slash(maybe_unserialize($value))) === false) throw new RuntimeException('Private tour metadata copy failed.');
        foreach (array('address' => $fields['boarding'], '_st_tour_dropoff' => $fields['dropoff'], '_is_custom_shadow_tour' => 'yes', 'type_tour' => 'daily_tour', 'duration_day' => $fields['duration']) as $meta_key => $value) tripanza_native_editor_meta_write($shadow, $meta_key, $value);
        $customer = get_user_by('email', $fields['email']); $user_id = $customer ? (int) $customer->ID : (get_userdata(1) ? 1 : get_current_user_id());
        $id = wp_insert_post(array('post_title' => 'Custom Booking - ' . $fields['first_name'] . ' - ' . $title, 'post_type' => 'st_order', 'post_status' => 'publish', 'post_author' => $user_id), true);
        if (is_wp_error($id) || !$id) throw new RuntimeException('Order creation failed.');
        $check_in = (new DateTimeImmutable($fields['check_in'] . ' 00:00:00', wp_timezone()))->getTimestamp(); $check_out = (new DateTimeImmutable($fields['check_out'] . ' 00:00:00', wp_timezone()))->getTimestamp();
        $guests = $fields['guests'] ?: array(array('name' => trim($fields['first_name'] . ' ' . $fields['last_name']), 'title' => 'mr')); $guest_data = tripanza_native_create_guest_data($guests);
        $total = $fields['custom_total']; $advance = $fields['advance_payment'];
        // As in the reference custom manager, entered package prices are the final
        // snapshot, not an extra GST charge. GST only affects later adjustments.
        $prices = array('total_price' => (string) $advance, 'deposit_price' => (string) $advance, 'booking_fee_price' => '0', 'coupon_price' => '0', 'price_coupon' => '0', 'sale_price' => (string) $total, 'total_price_with_tax' => (string) $total);
        $raw = array_merge(array('tour_id' => $shadow, 'id' => $shadow, 'item_id' => $shadow, 'service_id' => $shadow, 'check_in' => $fields['check_in'], 'check_out' => $fields['check_out'], 'check_in_timestamp' => $check_in, 'check_out_timestamp' => $check_out, 'check_in_date' => wp_date('m/d/Y', $check_in, wp_timezone()), 'adult_number' => $fields['adults'], 'child_number' => $fields['children'], 'infant_number' => $fields['infants'], 'duration' => $fields['duration'], 'adult_price' => $fields['quad_price'], 'child_price' => $fields['triple_price'], 'infant_price' => $fields['twin_price'], 'base_price' => (string) $fields['quad_price'], 'sale_price' => (string) $total, 'discount_rate' => 0, 'deposit_money' => array(), 'data_price' => array('total_price' => (string) $total), 'boarding_location' => $fields['boarding'], 'dropoff_location' => $fields['dropoff']), $guest_data);
        $currency = is_callable(array('TravelHelper', 'get_primary_currency')) ? TravelHelper::get_primary_currency() : 'INR'; if (is_array($currency)) $currency = $currency['name'] ?? 'INR'; $currency = strtoupper((string) $currency); if (!preg_match('/^[A-Z]{3}$/D', $currency)) $currency = 'INR';
        $metadata = array('data_prices' => $prices, 'raw_data' => wp_json_encode($raw), 'item_data' => $raw, 'st_cart_info' => array($shadow => array('title' => $title, 'id' => $shadow, 'link' => get_permalink($shadow) ?: home_url('/'), 'price' => $total, 'data' => $raw)),
            'item_id' => $shadow, 'service_id' => $shadow, 'room_id' => $shadow, 'st_booking_post_type' => 'st_tours', 'st_booking_id' => $shadow, 'type_tour' => 'daily_tour', 'duration' => $fields['duration'], 'custom_package_name' => $fields['custom_package_name'], 'currency' => $currency, 'balance_due_days' => $fields['balance_due_days'],
            'adult_price' => (string) $fields['quad_price'], 'child_price' => (string) $fields['triple_price'], 'infant_price' => (string) $fields['twin_price'], 'base_price' => (string) $fields['quad_price'], 'ori_price' => (string) $total, 'total_price' => (string) $advance, 'st_tax_percent' => is_callable(array('STPrice', 'getTax')) ? (string) STPrice::getTax() : '0',
            'st_first_name' => $fields['first_name'], 'st_last_name' => $fields['last_name'], 'st_email' => $fields['email'], 'st_phone' => $fields['phone'], 'guest_name' => $guest_data['guest_name'], 'guest_title' => $guest_data['guest_title'], 'check_in' => $fields['check_in'], 'check_out' => $fields['check_out'], 'check_in_date' => $raw['check_in_date'], 'item_data_check_in' => $fields['check_in'], 'item_data_check_out' => $fields['check_out'], 'check_in_timestamp' => $check_in, 'check_out_timestamp' => $check_out, 'booking_period' => $fields['check_in'] . ' / ' . $fields['check_out'],
            'adult_number' => $fields['adults'], 'child_number' => $fields['children'], 'infant_number' => $fields['infants'], 'status' => 'pending', 'payment_method' => 'offline', 'booking_by' => 'admin_custom', 'boarding_location' => $fields['boarding'], 'dropoff_location' => $fields['dropoff'], '_user_id' => $user_id, 'user_id' => $user_id, '_order_total' => $advance, 'order_token_code' => wp_generate_password(32, false, false));
        foreach ($metadata as $meta_key => $value) tripanza_native_editor_meta_write($id, $meta_key, $value);
        tripanza_native_create_mark($id, $key, $hash);
        if ($wpdb->insert($wpdb->prefix . 'st_order_item_meta', array('order_item_id' => $id, 'wc_order_id' => $id, 'st_booking_id' => $shadow, 'room_id' => $shadow, 'st_booking_post_type' => 'st_tours', 'type' => 'normal_booking', 'user_id' => $user_id, 'check_in' => $fields['check_in'], 'check_out' => $fields['check_out'], 'check_in_timestamp' => $check_in, 'status' => 'pending'), array('%d', '%d', '%d', '%d', '%s', '%s', '%d', '%s', '%s', '%d', '%s')) === false) throw new RuntimeException('Traveler registration failed.');
        if ($wpdb->query('COMMIT') === false) throw new RuntimeException('Commit failed.');
    } catch (Throwable $error) {
        $wpdb->query('ROLLBACK'); if (is_numeric($id) && $id) clean_post_cache($id); if (is_numeric($shadow) && $shadow) clean_post_cache($shadow);
        error_log('Tripanza native custom booking: ' . $error->getMessage()); return tripanza_native_admin_error('Custom booking could not be saved. No partial booking was committed.', 500);
    }
    return (int) $id;
}
function tripanza_native_create_post(WP_REST_Request $request) {
    $permission = tripanza_native_admin_permission(); if (is_wp_error($permission)) return $permission;
    $data = $request->get_json_params();
    if (!is_array($data) || !isset($data['nonce']) || !is_string($data['nonce']) || !wp_verify_nonce($data['nonce'], 'tripanza_native_booking_create')) return tripanza_native_admin_error('Refresh the booking manager to renew your session.', 403);
    if (!isset($data['request_id']) || !is_string($data['request_id']) || !preg_match('/^[a-zA-Z0-9-]{20,80}$/D', $data['request_id'])) return tripanza_native_admin_error('A valid creation request ID is required.', 422);
    $mode = $data['mode'] ?? ''; $key = 'tripanza_native_create_' . hash('sha256', get_current_user_id() . '|' . $data['request_id']);
    $hash = hash('sha256', wp_json_encode(array($mode, $data['fields'] ?? null)));
    // Check receipts before validating current tour availability: a completed
    // request must not create again just because a tour subsequently sold out.
    $receipt = get_option($key, false);
    if (is_array($receipt)) {
        if (!hash_equals($receipt['hash'], $hash)) return tripanza_native_admin_error('This request ID belongs to another booking payload.', 409);
        if (!empty($receipt['result'])) return tripanza_native_admin_response($receipt['result']);
        $recover = get_posts(array('post_type' => 'st_order', 'post_status' => 'any', 'posts_per_page' => 1, 'meta_key' => '_tripanza_native_create_key', 'meta_value' => $key));
        if ($recover && hash_equals((string) get_post_meta($recover[0]->ID, '_tripanza_native_create_hash', true), $hash)) return tripanza_native_admin_response(tripanza_native_create_response($recover[0]->ID, $mode, 'Recovered an existing booking. Check invoice delivery before resending; creation was not repeated.'));
        if (!empty($receipt['failed'])) return tripanza_native_admin_error($receipt['failed'], 422);
        return new WP_Error('tripanza_creation_pending', 'This request is still processing or needs verification in booking history. Do not submit a new booking.', array('status' => 409, 'uncertain' => true));
    }
    $fields = tripanza_native_create_validate($data); if (is_wp_error($fields)) return $fields;
    if (!tripanza_native_create_storage_ready()) return tripanza_native_admin_error('Traveler order storage is unavailable. No booking was created.', 503);
    if (!add_option($key, array('hash' => $hash, 'started' => time()), '', false)) return new WP_Error('tripanza_creation_pending', 'This request is already processing. Retry the same request.', array('status' => 409, 'uncertain' => true));
    $id = 0; $warning = '';
    if ($mode === 'standard') {
        // Capture the order before the existing function sends mail. An email
        // failure after insertion must never cause a second order on retry.
        $capture = function ($order, $tour) use (&$id, $fields, $key, $hash) {
            if ((int) $tour !== $fields['selected_tour_id'] || get_post_type($order) !== 'st_order') return;
            $id = absint($order); try { tripanza_native_create_mark($id, $key, $hash); } catch (Throwable $error) { error_log('Tripanza create receipt: ' . $error->getMessage()); }
        };
        add_action('st_booking_created', $capture, 1, 2);
        try {
            $returned = tripanza_create_tour_booking($fields['selected_tour_id'], $fields['first_name'], $fields['last_name'], $fields['email'], $fields['phone'], $fields['check_in'], $fields['adults'], $fields['children'], $fields['infants']);
            if (!is_wp_error($returned) && is_numeric($returned) && get_post_type(absint($returned)) === 'st_order') $id = absint($returned);
        } catch (Throwable $error) { error_log('Tripanza standard create: ' . $error->getMessage()); $warning = 'The booking function did not finish normally. Check the created booking and invoice delivery before resending.'; }
        finally { remove_action('st_booking_created', $capture, 1); }
        if (!$id) {
            if ($warning !== '') return new WP_Error('tripanza_creation_uncertain', 'The existing booking function did not confirm an order. Check booking history; do not create another yet.', array('status' => 500, 'uncertain' => true));
            update_option($key, array('hash' => $hash, 'failed' => 'Booking failed. The tour may be sold out, cancelled or unavailable for this date.'), false);
            return tripanza_native_admin_error('Booking failed. The tour may be sold out, cancelled or unavailable for this date.', 422);
        }
        try { tripanza_native_create_mark($id, $key, $hash); tripanza_native_create_apply_guests($id, $fields); }
        catch (Throwable $error) { error_log('Tripanza standard guests: ' . $error->getMessage()); $warning .= ' Booking exists, but traveller details need checking in the editor. Do not recreate it.'; }
        // Existing function owns standard pricing, availability, hooks and email.
    } else {
        $id = tripanza_native_create_custom($fields, $key, $hash);
        if (is_wp_error($id)) { update_option($key, array('hash' => $hash, 'failed' => $id->get_error_message()), false); return $id; }
    }
    // Store success before calling any custom notification hooks. Retrying must
    // return the existing booking, never repeat email/commission hooks.
    $result = tripanza_native_create_response($id, $mode, trim($warning));
    update_option($key, array('hash' => $hash, 'result' => $result), false);
    if ($mode === 'custom') {
        try { if (class_exists('STTour')) do_action('st_booking_created', $id, absint(get_post_meta($id, 'item_id', true))); }
        catch (Throwable $error) { error_log('Tripanza custom booking hook: ' . $error->getMessage()); $warning .= ' Booking created, but a booking hook failed; check downstream processing.'; }
        $warning .= ' ' . tripanza_native_booking_mail($id);
    } elseif (!is_callable(array('STCart', 'send_mail_after_booking'))) $warning .= ' Traveler invoice email delivery is unavailable.';
    $result = tripanza_native_create_response($id, $mode, trim($warning)); update_option($key, array('hash' => $hash, 'result' => $result), false);
    return tripanza_native_admin_response($result, 201);
}
add_action('rest_api_init', function () {
    register_rest_route('tripanza-headless/v1', '/admin/bookings/create', array(
        array('methods' => 'GET', 'permission_callback' => 'tripanza_native_admin_permission', 'callback' => 'tripanza_native_create_get'),
        array('methods' => 'POST', 'permission_callback' => 'tripanza_native_admin_permission', 'callback' => 'tripanza_native_create_post'),
    ));
});
