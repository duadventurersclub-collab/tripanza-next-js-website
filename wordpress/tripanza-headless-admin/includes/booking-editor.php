<?php
// Admin-only JSON editor. No page includes, remote HTML, or AJAX-handler execution.
defined('ABSPATH') || exit;
require_once __DIR__ . '/booking-editor-calculations.php';

function tripanza_native_editor_revision($id) {
    $meta = get_post_meta($id);
    unset($meta['_tripanza_editor_receipts'], $meta['tripanza_wallet_reverse_lock']);
    ksort($meta);
    return hash('sha256', wp_json_encode($meta));
}
function tripanza_native_editor_extras($id) {
    $stored = get_post_meta($id, 'extras', true); $result = array();
    if (!is_array($stored)) return $result;
    if (isset($stored['value']) && is_array($stored['value'])) {
        foreach ($stored['value'] as $key => $quantity) $result[] = array('title' => sanitize_text_field((string) ($stored['title'][$key] ?? '')), 'price' => tripanza_native_editor_number($stored['price'][$key] ?? 0), 'quantity' => max(0, (int) $quantity));
    } else {
        foreach ($stored as $extra) if (is_array($extra) && isset($extra['name'])) $result[] = array('title' => sanitize_text_field((string) $extra['name']), 'price' => tripanza_native_editor_number($extra['price'] ?? 0), 'quantity' => max(0, (int) ($extra['quantity'] ?? 0)));
    }
    return $result;
}
function tripanza_native_editor_counts($fields) { return array('adult' => $fields['adult_number'], 'child' => $fields['child_number'], 'infant' => $fields['infant_number']); }
function tripanza_native_editor_cost($fields, $pricing) {
    $extras = array('price' => array(), 'value' => array());
    foreach ($fields['addons'] as $addon) { $extras['price'][] = $addon['price']; $extras['value'][] = $addon['quantity']; }
    $counts = tripanza_native_editor_counts($fields);
    return round(tripanza_native_editor_item_cost($counts, $pricing['prices'], $extras)
        - tripanza_native_editor_sale_amount($counts, $pricing['prices'], $pricing['sale_rate'], $pricing['sale_type'])
        - tripanza_native_editor_group_discount($counts, $pricing['prices'], $pricing['sale_rate'], $pricing['sale_type'], $pricing['adult_rules'], $pricing['child_rules'], $pricing['bulk_type']), 2);
}
function tripanza_native_editor_load($id) {
    if (!tripanza_native_booking_ready()) return tripanza_native_admin_error('Traveler booking services are unavailable.', 503);
    global $wpdb;
    $row = tripanza_native_booking_row($id);
    if (!$row && get_post_type($id) === 'shop_order') {
        $table = $wpdb->prefix . 'st_order_item_meta';
        if ($wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $wpdb->esc_like($table))) === $table) $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE wc_order_id = %d AND st_booking_post_type = 'st_tours' LIMIT 1", $id));
    }
    $statuses = (array) STUser_f::_get_order_statuses();
    $booking = $row ? tripanza_native_booking_serialize($row, $statuses) : null;
    if (!$booking) return tripanza_native_admin_error('This Traveler tour booking is unavailable or unsupported.', 404);
    $get = function ($key) use ($id) { return get_post_meta($id, $key, true); };
    $text = function ($key) use ($get) { $value = $get($key); return is_scalar($value) ? sanitize_text_field((string) $value) : ''; };
    $tour_id = absint($get('item_id')) ?: absint($row->st_booking_id);
    $raw = $get('raw_data'); $raw = is_array($raw) ? $raw : json_decode((string) $raw, true); $raw = is_array($raw) ? $raw : array();
    $item = $get('item_data'); $item = is_array($item) ? $item : array();
    $cart = $get('st_cart_info'); $cart_data = is_array($cart) && isset($cart[$tour_id]['data']) && is_array($cart[$tour_id]['data']) ? $cart[$tour_id]['data'] : array();
    $prices = $get('data_prices'); $prices = is_array($prices) ? $prices : array();
    $snapshot = isset($cart_data['data_price']) && is_array($cart_data['data_price']) ? $cart_data['data_price'] : array();
    $first = function ($values) { foreach ($values as $value) if (is_scalar($value) && trim((string) $value) !== '') return sanitize_text_field((string) $value); return ''; };
    $date = function ($values) { foreach ($values as $value) { $parsed = tripanza_native_editor_normalize_date($value); if ($parsed !== '') return $parsed; } return ''; };
    $fields = array('selected_tour_id' => $tour_id, 'selected_tour_name' => html_entity_decode(get_the_title($tour_id), ENT_QUOTES, 'UTF-8'),
        'boarding' => $first(array($get('boarding_location'), $get('address'), $raw['boarding_location'] ?? '', $raw['address'] ?? '', $item['boarding_location'] ?? '', $item['address'] ?? '', $cart_data['boarding_location'] ?? '', $cart_data['address'] ?? '', get_post_meta($tour_id, 'address', true))),
        'dropoff' => $first(array($get('dropoff_location'), $get('_st_tour_dropoff'), $raw['dropoff_location'] ?? '', $raw['_st_tour_dropoff'] ?? '', $item['dropoff_location'] ?? '', $item['_st_tour_dropoff'] ?? '', $cart_data['dropoff_location'] ?? '', $cart_data['_st_tour_dropoff'] ?? '', get_post_meta($tour_id, '_st_tour_dropoff', true))),
        'departure_date' => $date(array($get('check_in_timestamp'), $get('check_in'), $raw['check_in'] ?? '', $get('item_data_check_in'), $item['check_in'] ?? '', $cart_data['check_in'] ?? '')),
        'return_date' => $date(array($get('check_out_timestamp'), $get('check_out'), $raw['check_out'] ?? '', $get('item_data_check_out'), $item['check_out'] ?? '', $cart_data['check_out'] ?? '')),
        'starttime' => $text('starttime'), 'duration' => $text('duration'), 'adult_number' => absint($get('adult_number')), 'child_number' => absint($get('child_number')), 'infant_number' => absint($get('infant_number')), 'addons' => tripanza_native_editor_extras($id), 'guests' => array());
    foreach (array('st_first_name', 'st_last_name', 'st_phone', 'st_email', 'st_city', 'st_note', 'transaction_id', 'balance_transaction_id') as $key) $fields[$key] = $key === 'st_note' ? sanitize_textarea_field((string) $get($key)) : $text($key);
    foreach (array('transaction_date', 'balance_transaction_date') as $key) $fields[$key] = $date(array($get($key)));
    $names = $get('guest_name'); if (!is_array($names) || !$names) $names = $raw['guest_name'] ?? array();
    $titles = $get('guest_title'); if (!is_array($titles) || !$titles) $titles = $raw['guest_title'] ?? array();
    $ages = $get('guest_age'); $ages = is_array($ages) ? $ages : array();
    foreach (is_array($names) ? $names : array() as $index => $name) if (is_scalar($name)) $fields['guests'][] = array('name' => sanitize_text_field((string) $name), 'title' => sanitize_text_field((string) ($titles[$index] ?? '')), 'age' => absint($ages[$index] ?? 0));
    $financials = tripanza_native_editor_financial_summary($id, $prices);
    $fields['total_price'] = $financials['amount_paid'];
    $unit_prices = array(); $gross = 0;
    foreach (array('adult', 'child', 'infant') as $type) { $unit_prices[$type] = tripanza_native_editor_number($get($type . '_price')) ?: tripanza_native_editor_number($prices[$type . '_price'] ?? 0); $gross += $fields[$type . '_number'] * $unit_prices[$type]; }
    // Saved rate first. Infer only a missing sale from the immutable checkout snapshot.
    $sale_rate = tripanza_native_editor_number($cart_data['discount_rate'] ?? 0) ?: tripanza_native_editor_number($get('discount_rate'));
    $sale_type = ($cart_data['discount_type'] ?? get_post_meta($tour_id, 'discount_type', true)) === 'amount' ? 'amount' : 'percent';
    $saved_group = tripanza_native_editor_number($snapshot['total_bulk_discount'] ?? ($prices['total_bulk_discount'] ?? 0));
    $core = tripanza_native_editor_number($snapshot['total_price'] ?? 0);
    if ($sale_rate <= 0 && $core > 0 && $gross > 0) { $inferred = max(0, $gross - $core - $saved_group); if ($inferred > 0) { $sale_rate = min(100, $inferred / $gross * 100); $sale_type = 'percent'; } }
    $rules = function ($key) use ($tour_id) { $stored = get_post_meta($tour_id, $key, true); $result = array(); foreach (is_array($stored) ? $stored : array() as $rule) if (is_array($rule)) $result[] = array('key' => absint($rule['key'] ?? 0), 'value' => tripanza_native_editor_number($rule['value'] ?? 0)); return $result; };
    $manual = metadata_exists('post', $id, 'tripanza_manual_adjustment_total') ? (float) $get('tripanza_manual_adjustment_total') : 0;
    $auto = metadata_exists('post', $id, 'tripanza_auto_adjustment_total') ? (float) $get('tripanza_auto_adjustment_total') : round($financials['adjustment'] - $manual, 2);
    if (abs($auto + $manual - $financials['adjustment']) > .001) $auto = round($financials['adjustment'] - $manual, 2); // Respect compatibility edits from other admin tools.
    $ledger = $get('tripanza_manual_adjustment_ledger'); $ledger = is_array($ledger) ? array_reverse(array_values(array_filter($ledger, 'is_array'))) : array();
    $coupon = strtoupper(trim($text('coupon_code'))); $coupon_amount = tripanza_native_editor_number($get('coupon_amount')) ?: tripanza_native_editor_number($prices['coupon_price'] ?? 0);
    $packages = array();
    foreach (array('package_hotel_price' => 'Hotel add-on', 'package_activity_price' => 'Activity add-on', 'package_car_price' => 'Car add-on', 'package_flight_price' => 'Flight add-on', 'price_equipment' => 'Equipment') as $key => $label) { $amount = tripanza_native_editor_number($get($key)) ?: tripanza_native_editor_number($cart_data[$key] ?? ($snapshot[$key] ?? ($prices[$key] ?? 0))); if ($amount > 0) $packages[] = array('label' => $label, 'amount' => $amount); }
    $closed = in_array(str_replace('-', '_', $booking['status_key']), array('complete', 'completed', 'fully_paid', 'refunded', 'canceled', 'cancelled'), true);
    $token = $text('order_token_code'); $args = array('order_id' => $id); if ($token !== '') $args['order_token_code'] = $token;
    $urls = $closed ? array('payu' => '', 'upi' => '') : array('payu' => esc_url_raw(add_query_arg($args, home_url('/advance-payu-payment/'))), 'upi' => esc_url_raw(add_query_arg($args, home_url('/advance-upi-payment/'))));
    $used = tripanza_native_editor_number($get('tripanza_wallet_used')); $reversed = (bool) $get('wallet_reversed');
    $user = wp_get_current_user(); $payment = $text('payment_method');
    if (is_callable(array('STPaymentGateways', 'get_gatewayname'))) $payment = sanitize_text_field(wp_strip_all_tags((string) STPaymentGateways::get_gatewayname($payment)));
    $all_statuses = is_callable(array('STUser_f', '_get_all_order_statuses')) ? (array) STUser_f::_get_all_order_statuses() : $statuses;
    $status_label = sanitize_text_field(wp_strip_all_tags((string) ($all_statuses[$booking['status_key']] ?? $booking['status'])));
    if ($get('cancel_refund_status') === 'pending') $status_label = 'Cancelling';
    return array('editor_api_version' => '1.0.0', 'user' => array('name' => $user->display_name), 'nonce' => wp_create_nonce('tripanza_native_booking_editor'), 'revision' => tripanza_native_editor_revision($id), 'booking' => $booking,
        'fields' => $fields, 'financials' => $financials, 'pricing' => array('prices' => $unit_prices, 'sale_rate' => $sale_rate, 'sale_type' => $sale_type, 'bulk_type' => get_post_meta($tour_id, 'discount_by_people_type', true) === 'amount' ? 'amount' : 'percent', 'adult_rules' => $rules('discount_by_adult'), 'child_rules' => $rules('discount_by_child'), 'saved_group_discount' => $saved_group),
        'auto_adjustment' => $auto, 'manual_total' => $manual, 'ledger' => $ledger, 'created' => get_post_time('j M Y', false, $id), 'country_code' => $text('st_country_code'), 'payment_method' => $payment, 'status_label' => $status_label,
        'statuses' => array_map('sanitize_text_field', $statuses), 'host_name' => $booking['host'] ?: ($booking['source'] === 'Partner direct' ? $booking['owner'] : 'Tripanza'), 'coupon_code' => $coupon, 'coupon_amount' => $coupon_amount, 'packages' => $packages,
        'tax_included' => function_exists('st') && st()->get_option('st_tax_include_enable', 'off') === 'on', 'payment_urls' => $urls, 'mail_available' => is_callable(array('STCart', 'send_mail_after_booking')), 'whatsapp_available' => function_exists('tripanza_send_whatsapp'),
        'wallet' => array('reversed' => $reversed, 'used' => $used, 'can_reverse' => !$reversed && $used > 0 && (bool) $get('tripanza_wallet_debited') && function_exists('update_wallet_balance')), 'readonly' => !$booking['editable'] || $booking['archived'] || (bool) $get('wc_order_id'));
}
function tripanza_native_editor_get(WP_REST_Request $request) {
    $id = absint($request['id']); $data = tripanza_native_editor_load($id); if (is_wp_error($data)) return $data;
    if ($request->has_param('search')) {
        $search = $request->get_param('search'); if (!is_string($search) || strlen($search) < 2 || strlen($search) > 100) return tripanza_native_admin_error('Search must contain 2–100 characters.');
        $query = new WP_Query(array('post_type' => 'st_tours', 'post_status' => 'publish', 's' => sanitize_text_field($search), 'posts_per_page' => 15, 'no_found_rows' => true));
        return tripanza_native_admin_response(array('tours' => array_map(function ($tour) { return array('id' => (int) $tour->ID, 'name' => html_entity_decode(get_the_title($tour), ENT_QUOTES, 'UTF-8')); }, $query->posts)));
    }
    return tripanza_native_admin_response($data);
}
// Validate all fields before a single write; client-calculated totals are never trusted.
function tripanza_native_editor_validate($input, $before, $manual) {
    if (!is_array($input) || !is_array($manual)) return tripanza_native_admin_error('Editor fields and adjustment are required.', 422);
    $clean = array();
    foreach (array('selected_tour_id', 'adult_number', 'child_number', 'infant_number') as $key) {
        $value = $input[$key] ?? null;
        if ((!is_int($value) && !is_string($value)) || !ctype_digit((string) $value) || (float) $value > ($key === 'selected_tour_id' ? PHP_INT_MAX : 500)) return tripanza_native_admin_error('Tour ID and traveller counts must be valid whole numbers.', 422);
        $clean[$key] = (int) $value;
    }
    if ($clean['adult_number'] + $clean['child_number'] + $clean['infant_number'] < 1 || $clean['adult_number'] + $clean['child_number'] + $clean['infant_number'] > 500) return tripanza_native_admin_error('Choose between 1 and 500 travellers.', 422);
    $tour = get_post($clean['selected_tour_id']);
    if (!$tour || $tour->post_type !== 'st_tours' || ($clean['selected_tour_id'] !== $before['fields']['selected_tour_id'] && $tour->post_status !== 'publish')) return tripanza_native_admin_error('Select an available published tour.', 422);
    foreach (array('boarding', 'dropoff', 'starttime', 'duration', 'st_first_name', 'st_last_name', 'st_phone', 'st_email', 'st_city', 'st_note', 'transaction_id', 'balance_transaction_id') as $key) {
        if (!isset($input[$key]) || !is_string($input[$key]) || strlen($input[$key]) > ($key === 'st_note' ? 8000 : 500)) return tripanza_native_admin_error('A text field is missing or too long.', 422);
        $clean[$key] = $key === 'st_note' ? sanitize_textarea_field($input[$key]) : sanitize_text_field($input[$key]);
    }
    if ($clean['st_email'] !== '' && (!is_email($clean['st_email']) || strlen($clean['st_email']) > 254)) return tripanza_native_admin_error('Enter a valid customer email.', 422);
    foreach (array('departure_date', 'return_date', 'transaction_date', 'balance_transaction_date') as $key) {
        if (!isset($input[$key]) || !is_string($input[$key]) || ($input[$key] !== '' && !tripanza_native_admin_valid_date($input[$key]))) return tripanza_native_admin_error('Enter valid ISO dates.', 422);
        $clean[$key] = $input[$key];
        if ($clean[$key] === '' && in_array($key, array('departure_date', 'return_date'), true)) $clean[$key] = $before['fields'][$key];
    }
    if ($clean['departure_date'] !== '' && $clean['return_date'] !== '' && $clean['return_date'] < $clean['departure_date']) return tripanza_native_admin_error('Return date cannot be before departure.', 422);
    $clean['guests'] = array();
    if (!isset($input['guests']) || !is_array($input['guests']) || count($input['guests']) > 500) return tripanza_native_admin_error('Invalid guest list.', 422);
    foreach ($input['guests'] as $guest) {
        if (!is_array($guest) || !isset($guest['name'], $guest['title']) || !is_string($guest['name']) || !is_string($guest['title']) || strlen($guest['name']) > 200 || strlen($guest['title']) > 30) return tripanza_native_admin_error('Invalid guest name or title.', 422);
        $age = $guest['age'] ?? 0; if (!is_numeric($age) || (float) $age < 0 || (float) $age > 120 || floor((float) $age) !== (float) $age) return tripanza_native_admin_error('Invalid guest age.', 422);
        $clean['guests'][] = array('name' => sanitize_text_field($guest['name']), 'title' => sanitize_text_field($guest['title']), 'age' => (int) $age);
    }
    $clean['addons'] = array();
    if (!isset($input['addons']) || !is_array($input['addons']) || count($input['addons']) > 100) return tripanza_native_admin_error('Invalid add-on list.', 422);
    foreach ($input['addons'] as $addon) {
        if (!is_array($addon) || !isset($addon['title']) || !is_string($addon['title']) || strlen($addon['title']) > 200) return tripanza_native_admin_error('Invalid add-on title.', 422);
        $price = tripanza_native_editor_money_input($addon['price'] ?? null); $qty = $addon['quantity'] ?? null;
        if ($price === false || (!is_int($qty) && !is_string($qty)) || !ctype_digit((string) $qty) || (float) $qty > 5000) return tripanza_native_admin_error('Add-on prices must be positive and quantities whole numbers.', 422);
        if (trim($addon['title']) === '' && (int) $qty > 0) return tripanza_native_admin_error('Name each selected add-on.', 422);
        $clean['addons'][] = array('title' => sanitize_text_field($addon['title']), 'price' => $price, 'quantity' => (int) $qty);
    }
    $advance = tripanza_native_editor_money_input($input['total_price'] ?? null); $amount = tripanza_native_editor_money_input($manual['amount'] ?? null);
    if ($advance === false || $amount === false || !isset($manual['type'], $manual['reason'], $manual['internal_note']) || !in_array($manual['type'], array('charge', 'credit'), true) || !is_string($manual['reason']) || !is_string($manual['internal_note']) || strlen($manual['reason']) > 500 || strlen($manual['internal_note']) > 4000) return tripanza_native_admin_error('Enter a valid payment and manual charge/credit.', 422);
    if ($amount > 0 && trim($manual['reason']) === '') return tripanza_native_admin_error('A customer-facing reason is required for charges or credits.', 422);
    $clean['total_price'] = $advance;
    return array('fields' => $clean, 'manual' => array('type' => $manual['type'], 'amount' => $amount, 'reason' => sanitize_text_field($manual['reason']), 'internal_note' => sanitize_textarea_field($manual['internal_note'])));
}
function tripanza_native_editor_money_input($value) {
    if ((!is_int($value) && !is_float($value) && !is_string($value)) || !preg_match('/^[0-9]+(?:\.[0-9]{1,2})?$/D', (string) $value) || (float) $value > 100000000) return false;
    return round((float) $value, 2);
}
// Refuse atomic money edits if any participating table cannot roll back.
function tripanza_native_editor_begin($wallet = false) {
    global $wpdb;
    $tables = array($wpdb->posts, $wpdb->postmeta, $wpdb->prefix . 'st_order_item_meta'); if ($wallet) $tables[] = $wpdb->usermeta;
    foreach ($tables as $table) { $info = $wpdb->get_row($wpdb->prepare('SHOW TABLE STATUS LIKE %s', $wpdb->esc_like($table)), ARRAY_A); if (!$info || strtolower($info['Engine'] ?? '') !== 'innodb') return tripanza_native_admin_error('Atomic booking updates require InnoDB storage. No changes were made.', 503); }
    if ($wpdb->query('START TRANSACTION') === false) return tripanza_native_admin_error('Booking transaction could not start.', 503);
    return true;
}
function tripanza_native_editor_meta_write($id, $key, $value) {
    update_post_meta($id, $key, wp_slash($value));
    $saved = get_post_meta($id, $key, true);
    if (is_array($value) ? $saved !== $value : (string) $saved !== (string) $value) throw new RuntimeException('Metadata update failed: ' . $key);
}
function tripanza_native_editor_apply($id, $before, $validated, $receipt) {
    global $wpdb; $fields = $validated['fields']; $manual = $validated['manual'];
    $item_delta = round(tripanza_native_editor_cost($fields, $before['pricing']) - tripanza_native_editor_cost($before['fields'], $before['pricing']), 2);
    $auto = round($before['auto_adjustment'] + $item_delta, 2); $delta = $manual['amount'] * ($manual['type'] === 'credit' ? -1 : 1);
    $manual_total = round($before['manual_total'] + $delta, 2); $adjustment = round($auto + $manual_total, 2);
    $prices = get_post_meta($id, 'data_prices', true); $prices = is_array($prices) ? $prices : array();
    $financials = tripanza_native_editor_financial_summary($id, $prices, $adjustment);
    if ($financials['raw_final_total'] < 0) return tripanza_native_admin_error('Credit cannot exceed the current booking total including GST.', 422);
    if ($fields['total_price'] > $financials['final_total'] && abs($fields['total_price'] - $before['financials']['amount_paid']) >= 0.01) return tripanza_native_admin_error('Advance payment cannot exceed the booking total. An existing overpayment can remain unchanged.', 422);
    $started = tripanza_native_editor_begin(); if (is_wp_error($started)) return $started;
    $linked_wc_id = absint(get_post_meta($id, 'wc_order_id', true));
    // Do not silently damage WooCommerce-linked bookings or synchronize unrelated WC items.
    if ($linked_wc_id) { $wpdb->query('ROLLBACK'); return tripanza_native_admin_error('This booking has a WooCommerce link. Use its existing WordPress editor for lifecycle-safe changes.', 409); }
    $write = function ($key, $value) use ($id) { tripanza_native_editor_meta_write($id, $key, $value); };
    try {
        $old_tour = $before['fields']['selected_tour_id']; $tour = $fields['selected_tour_id'];
        $raw = get_post_meta($id, 'raw_data', true); $raw = is_array($raw) ? $raw : json_decode((string) $raw, true); $raw = is_array($raw) ? $raw : array();
        $item = get_post_meta($id, 'item_data', true); $item = is_array($item) ? $item : array();
        $cart = get_post_meta($id, 'st_cart_info', true); $cart = is_array($cart) ? $cart : array();
        $cart_item = isset($cart[$old_tour]) && is_array($cart[$old_tour]) ? $cart[$old_tour] : array();
        $cart_data = isset($cart_item['data']) && is_array($cart_item['data']) ? $cart_item['data'] : array();
        $changes = array(); foreach (array('st_booking_id', 'item_id', 'service_id', 'room_id', '_tour_id') as $key) { $write($key, $tour); $changes[$key] = $tour; } $changes['tour_id'] = $tour; $changes['id'] = $tour;
        if ($old_tour !== $tour) {
            $inventory = function_exists('tripanza_get_inventory_trip_id') ? absint(tripanza_get_inventory_trip_id($tour)) : (absint(get_post_meta($tour, 'host_parent_trip_id', true)) ?: $tour);
            $host = $inventory !== $tour ? (function_exists('tripanza_get_selling_host_id') ? absint(tripanza_get_selling_host_id($tour)) : absint(get_post_field('post_author', $tour))) : 0;
            foreach (array('tripanza_storefront_id' => $tour, 'tripanza_inventory_trip_id' => $inventory, 'tripanza_selling_host_user_id' => $host, 'tripanza_trip_owner_user_id' => absint(get_post_field('post_author', $inventory))) as $key => $value) $write($key, $value);
        }
        foreach (array('starttime', 'duration', 'adult_number', 'child_number', 'infant_number') as $key) { $write($key, $fields[$key]); $changes[$key] = $fields[$key]; }
        foreach (array('boarding_location' => $fields['boarding'], 'address' => $fields['boarding'], 'dropoff_location' => $fields['dropoff'], '_st_tour_dropoff' => $fields['dropoff']) as $key => $value) { $write($key, $value); $changes[$key] = $value; }
        $date_changes = array();
        foreach (array('check_in' => 'departure_date', 'check_out' => 'return_date') as $key => $field) if ($fields[$field] !== '') {
            $timestamp = (new DateTimeImmutable($fields[$field] . ' 00:00:00', wp_timezone()))->getTimestamp();
            $write($key, $fields[$field]); $write($key . '_timestamp', $timestamp); $write('item_data_' . $key, $fields[$field]);
            $changes[$key] = $fields[$field]; $changes[$key . '_timestamp'] = $timestamp; $date_changes[$key] = $fields[$field]; $date_changes[$key . '_timestamp'] = $timestamp;
        }
        if (isset($date_changes['check_in'], $date_changes['check_out'])) { $write('booking_period', $date_changes['check_in'] . ' / ' . $date_changes['check_out']); $changes['check_in_date'] = wp_date('m/d/Y', $date_changes['check_in_timestamp'], wp_timezone()); $write('check_in_date', $changes['check_in_date']); }
        $names = array_column($fields['guests'], 'name'); $titles = array_column($fields['guests'], 'title'); $ages = array_column($fields['guests'], 'age');
        foreach (array('guest_name' => $names, 'guest_title' => $titles, 'guest_age' => $ages) as $key => $value) { $write($key, $value); $changes[$key] = $value; }
        $adults = array(); foreach ($fields['guests'] as $guest) { $parts = preg_split('/\s+/', trim($guest['name']), 2); $adults[] = array('title' => $guest['title'], 'first_name' => $parts[0] ?? '', 'last_name' => $parts[1] ?? '', 'age' => $guest['age']); } $changes['adult'] = $adults;
        $extras = array('title' => array(), 'price' => array(), 'value' => array());
        foreach ($fields['addons'] as $index => $addon) if ($addon['title'] !== '' && $addon['quantity'] > 0) { $key = sanitize_title($addon['title']) . '_' . $index; $extras['title'][$key] = $addon['title']; $extras['price'][$key] = $addon['price']; $extras['value'][$key] = $addon['quantity']; }
        $write('extras', $extras); $changes['extras'] = $extras;
        $extra_price = 0; foreach ($fields['addons'] as $addon) $extra_price += $addon['price'] * $addon['quantity']; $write('extra_price', round($extra_price, 2)); $changes['extra_price'] = round($extra_price, 2);
        foreach (array('st_first_name', 'st_last_name', 'st_phone', 'st_email', 'st_city', 'st_note', 'transaction_id', 'transaction_date', 'balance_transaction_id', 'balance_transaction_date') as $key) $write($key, $fields[$key]);
        $write('_traveler_name', trim($fields['st_first_name'] . ' ' . $fields['st_last_name'])); $write('_traveler_email', $fields['st_email']); $write('_traveler_phone', $fields['st_phone']); $write('_guests', array_sum(tripanza_native_editor_counts($fields)));
        $write('tripanza_auto_adjustment_total', $auto); $write('tripanza_manual_adjustment_total', $manual_total); $write('admin_backend_adjustment', $adjustment);
        if ($manual['amount'] > 0) {
            $ledger = get_post_meta($id, 'tripanza_manual_adjustment_ledger', true); $ledger = is_array($ledger) ? $ledger : array(); $user = wp_get_current_user(); $tax = round($delta * $financials['tax_percent'] / 100, 2);
            $ledger[] = array('id' => $receipt['id'], 'type' => $manual['type'], 'amount' => $delta, 'tax' => $tax, 'total_effect' => round($delta + $tax, 2), 'customer_reason' => $manual['reason'], 'internal_note' => $manual['internal_note'], 'created_at' => current_time('mysql'), 'user_id' => get_current_user_id(), 'user_name' => $user->display_name); $write('tripanza_manual_adjustment_ledger', $ledger);
        }
        // Only the received-payment field changes. Do not reprice the checkout snapshot.
        $prices['total_price'] = $fields['total_price']; $write('data_prices', $prices); $write('total_price', (string) $fields['total_price']); $write('_order_total', $fields['total_price']);
        $write('raw_data', wp_json_encode(array_replace($raw, $changes))); $write('item_data', array_replace($item, $changes));
        $cart_item['data'] = array_replace($cart_data, $changes); $cart_item['id'] = $tour; $cart_item['title'] = get_the_title($tour); $cart_item['link'] = get_permalink($tour);
        if ($old_tour !== $tour) unset($cart[$old_tour]); $cart[$tour] = $cart_item; $write('st_cart_info', $cart);
        $table = $wpdb->prefix . 'st_order_item_meta';
        $db_fields = array('st_booking_id' => $tour, 'room_id' => $tour); $formats = array('%d', '%d');
        if (isset($date_changes['check_in'])) { $db_fields['check_in'] = $date_changes['check_in']; $db_fields['check_in_timestamp'] = $date_changes['check_in_timestamp']; $formats[] = '%s'; $formats[] = '%d'; }
        if (isset($date_changes['check_out'])) { $db_fields['check_out'] = $date_changes['check_out']; $formats[] = '%s'; }
        if ($wpdb->update($table, $db_fields, array('order_item_id' => $id), $formats, array('%d')) === false) throw new RuntimeException('Traveler item update failed.');
        tripanza_native_editor_store_receipt($id, $receipt['id'], $receipt['hash'], 'saved');
        if ($wpdb->query('COMMIT') === false) throw new RuntimeException('Commit failed.');
    } catch (Throwable $error) { $wpdb->query('ROLLBACK'); clean_post_cache($id); wp_cache_delete($id, 'post_meta'); error_log('Tripanza editor save: ' . $error->getMessage()); return tripanza_native_admin_error('Booking save failed. No partial changes were committed. Refresh before retrying.', 500); }
    clean_post_cache($id); return tripanza_native_editor_load($id);
}
function tripanza_native_editor_store_receipt($id, $key, $hash, $state) {
    $receipts = get_post_meta($id, '_tripanza_editor_receipts', true); $receipts = is_array($receipts) ? $receipts : array();
    $receipts[$key] = array('hash' => $hash, 'state' => $state, 'time' => time()); $receipts = array_slice($receipts, -30, null, true);
    tripanza_native_editor_meta_write($id, '_tripanza_editor_receipts', $receipts);
}
function tripanza_native_editor_whatsapp($data, $phone) {
    $f = $data['fields']; $v = $data['financials']; $currency = $data['booking']['currency'];
    $money = function ($amount) use ($currency) { return $currency . ' ' . number_format($amount, 2, '.', ','); };
    $message = "*Booking Details*\nBooking ID: #" . $data['booking']['id'] . "\nBooking Date: " . $data['created'] . "\nTour Name: " . $f['selected_tour_name'] . "\nTravel Dates: " . $f['departure_date'] . ' - ' . $f['return_date'] . "\nDuration: " . $f['duration'] . "\nBoarding: " . $f['boarding'] . "\nDrop-off: " . $f['dropoff'] . "\nTotal Passengers: " . array_sum(tripanza_native_editor_counts($f)) . "\nTotal Amount: " . $money($v['final_total']) . "\nAdvance Payment: " . $money($v['amount_paid']) . "\nRemaining Balance: " . $money($v['balance']) . "\nPayment Method: " . $data['payment_method'] . "\nBooking Status: " . $data['status_label'] . "\nCustomer: " . $f['st_first_name'] . ' ' . $f['st_last_name'] . "\nEmail: " . $f['st_email'] . "\nPhone: " . $data['country_code'] . $f['st_phone'];
    foreach ($data['payment_urls'] as $name => $url) if ($url !== '') $message .= "\n" . strtoupper($name) . ': ' . $url;
    return tripanza_send_whatsapp($phone, $message);
}
function tripanza_native_editor_reverse_wallet($id, $before, $receipt) {
    if ($before['wallet']['reversed']) return $before;
    if (!$before['wallet']['can_reverse']) return tripanza_native_admin_error('No reversible wallet debit exists. Promotional coupons are not wallet credits.', 409);
    if (!add_post_meta($id, 'tripanza_wallet_reverse_lock', current_time('mysql'), true)) return tripanza_native_admin_error('Wallet reversal is already being processed.', 409);
    $user_id = absint(get_post_meta($id, 'id_user', true)) ?: absint(get_post_field('post_author', $id));
    $user_lock = 'tripanza_native_wallet_user_' . $user_id;
    if (!$user_id || !add_option($user_lock, time(), '', false)) {
        $previous = (int) get_option($user_lock); if ($previous && $previous < time() - 120) delete_option($user_lock);
        delete_post_meta($id, 'tripanza_wallet_reverse_lock'); return tripanza_native_admin_error('Wallet account is unavailable or busy. Retry shortly.', 409);
    }
    global $wpdb; $started = tripanza_native_editor_begin(true);
    if (is_wp_error($started)) { delete_option($user_lock); delete_post_meta($id, 'tripanza_wallet_reverse_lock'); return $started; }
    try {
        $balance = (float) get_user_meta($user_id, 'wallet_balance', true);
        $result = update_wallet_balance($user_id, $before['wallet']['used'], 'Cashback restored from booking #' . $id, 'credit', 'cashback');
        if ($result === false || abs((float) get_user_meta($user_id, 'wallet_balance', true) - ($balance + $before['wallet']['used'])) > .001) throw new RuntimeException('Wallet credit failed.');
        tripanza_native_editor_meta_write($id, 'wallet_reversed', 1); tripanza_native_editor_meta_write($id, 'tripanza_wallet_debited', 0);
        tripanza_native_editor_store_receipt($id, $receipt['id'], $receipt['hash'], 'saved');
        if ($wpdb->query('COMMIT') === false) throw new RuntimeException('Wallet commit failed.');
    } catch (Throwable $error) { $wpdb->query('ROLLBACK'); wp_cache_delete($id, 'post_meta'); wp_cache_delete($user_id, 'user_meta'); return tripanza_native_admin_error('Wallet reversal failed. Refresh and inspect the wallet before retrying.', 500); }
    finally { delete_option($user_lock); delete_post_meta($id, 'tripanza_wallet_reverse_lock'); }
    return tripanza_native_editor_load($id);
}
function tripanza_native_editor_post(WP_REST_Request $request) {
    $id = absint($request['id']); $input = $request->get_json_params();
    if (!is_array($input) || !isset($input['nonce']) || !is_string($input['nonce']) || !wp_verify_nonce($input['nonce'], 'tripanza_native_booking_editor')) return tripanza_native_admin_error('Editor session expired. Refresh and try again.', 403);
    $action = $input['action'] ?? null;
    if (!is_string($action) || !in_array($action, array('save', 'status', 'resend', 'whatsapp', 'reverse_wallet'), true)) return tripanza_native_admin_error('Action not allowed.');
    $key = $input['request_id'] ?? ''; if (!is_string($key) || !preg_match('/^[A-Za-z0-9-]{16,80}$/D', $key)) return tripanza_native_admin_error('A valid request ID is required.');
    $hash_input = $input; unset($hash_input['nonce'], $hash_input['revision']); $hash = hash('sha256', wp_json_encode($hash_input));
    $lock = 'tripanza_native_booking_lock_' . $id;
    if (!add_option($lock, time(), '', false)) { $previous = (int) get_option($lock); if ($previous && $previous < time() - 120) delete_option($lock); return tripanza_native_admin_error('Booking is busy. Refresh or retry shortly.', 409); }
    try {
        $before = tripanza_native_editor_load($id); if (is_wp_error($before)) return $before;
        if ($before['readonly']) return tripanza_native_admin_error('Archived or WooCommerce bookings cannot be edited here. Restore archived bookings first; legacy WooCommerce uses its own editor.', 409);
        $receipts = get_post_meta($id, '_tripanza_editor_receipts', true); $previous = is_array($receipts) ? ($receipts[$key] ?? null) : null;
        if ($previous) {
            if (!hash_equals($previous['hash'], $hash)) return tripanza_native_admin_error('Request ID was reused with different changes.', 409);
            if (!in_array($previous['state'], array('saved', 'sent'), true)) return tripanza_native_admin_error('The earlier delivery is unconfirmed. Check its delivery before sending again.', 409);
            return tripanza_native_admin_response(array('ok' => true, 'editor' => $before, 'message' => 'This request was already completed. No duplicate action was performed.'));
        }
        if (!isset($input['revision']) || !is_string($input['revision']) || !hash_equals($before['revision'], $input['revision'])) return tripanza_native_admin_error('This booking changed in another session. Refresh before editing it again.', 409);
        $receipt = array('id' => $key, 'hash' => $hash); $warning = ''; $message = 'All details updated successfully!';
        if ($action === 'save') {
            $validated = tripanza_native_editor_validate($input['fields'] ?? null, $before, $input['manual'] ?? null); if (is_wp_error($validated)) return $validated;
            $after = tripanza_native_editor_apply($id, $before, $validated, $receipt); if (is_wp_error($after)) return $after;
        } elseif ($action === 'reverse_wallet') {
            if (($input['confirmation'] ?? '') !== 'REVERSE WALLET') return tripanza_native_admin_error('Confirm the wallet reversal.');
            $after = tripanza_native_editor_reverse_wallet($id, $before, $receipt); if (is_wp_error($after)) return $after;
            $message = 'Wallet debit restored once. The original checkout coupon snapshot is unchanged.';
        } else {
            if ($action === 'status') {
                $status = $input['status'] ?? null; if (!is_string($status) || !isset($before['statuses'][$status])) return tripanza_native_admin_error('Choose a valid booking status.');
                if ($before['booking']['status_key'] !== $status) { tripanza_native_editor_meta_write($id, 'status', $status); $warning = tripanza_native_booking_mail($id); } $message = 'Status updated.';
            } elseif ($action === 'resend') {
                tripanza_native_editor_store_receipt($id, $key, $hash, 'pending');
                $warning = tripanza_native_booking_mail($id); if ($warning) return tripanza_native_admin_error($warning . ' Check delivery before sending again.', 502); $message = 'Confirmation email sent.';
            } elseif ($action === 'whatsapp') {
                if (!function_exists('tripanza_send_whatsapp')) return tripanza_native_admin_error('Activate the Tripanza WhatsApp delivery module.', 503);
                $phone = $input['phone'] ?? ''; if (!is_string($phone) || !preg_match('/^\+?[0-9\s().-]+$/D', $phone)) return tripanza_native_admin_error('Enter a valid WhatsApp number.');
                $phone = ltrim(preg_replace('/\D/', '', $phone), '0'); if (strlen($phone) === 10) $phone = '91' . $phone;
                if (!preg_match('/^[1-9][0-9]{9,14}$/D', $phone)) return tripanza_native_admin_error('Enter a valid international WhatsApp number.');
                tripanza_native_editor_store_receipt($id, $key, $hash, 'pending'); $sent = tripanza_native_editor_whatsapp($before, $phone);
                if (!$sent || is_wp_error($sent)) return tripanza_native_admin_error('WhatsApp delivery was not confirmed. Check delivery before sending again.', 502); $message = 'Summary sent via the Tripanza WhatsApp bot.';
            }
            tripanza_native_editor_store_receipt($id, $key, $hash, 'sent'); $after = tripanza_native_editor_load($id);
        }
        return tripanza_native_admin_response(array('ok' => true, 'editor' => $after, 'warning' => $warning, 'message' => $message));
    } catch (Throwable $error) { error_log('Tripanza native editor: ' . $error->getMessage()); return tripanza_native_admin_error('The action could not be confirmed. Refresh the saved booking before retrying.', 500); }
    finally { delete_option($lock); }
}
add_action('rest_api_init', function () {
    register_rest_route('tripanza-headless/v1', '/admin/bookings/(?P<id>[1-9][0-9]*)/editor', array(
        array('methods' => 'GET', 'permission_callback' => 'tripanza_native_admin_permission', 'callback' => 'tripanza_native_editor_get'),
        array('methods' => 'POST', 'permission_callback' => 'tripanza_native_admin_permission', 'callback' => 'tripanza_native_editor_post'),
    ));
});
