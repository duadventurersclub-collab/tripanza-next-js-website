<?php
defined('ABSPATH') || exit;
// Same Traveler source, status labels, pricing and archive exclusion as the reference dashboard.
// JSON only: no hidden booking table or WordPress page rendering.
function tripanza_native_admin_bookings() {
    if (!is_callable(array('STUser_f', 'get_history_bookings')) || !is_callable(array('STUser_f', '_get_order_statuses')) || !is_callable(array('STPrice', 'getTotalPriceWithTaxInOrder'))) return array();
    $history = STUser_f::get_history_bookings('st_tours', 0, 1000, get_current_user_id());
    $statuses = STUser_f::_get_order_statuses();
    $rows = array();
    foreach ((array) ($history['rows'] ?? array()) as $value) {
        $id = absint($value->wc_order_id);
        if (get_post_meta($id, '_tz_booking_archived', true) === '1') continue;
        $prices = get_post_meta($id, 'data_prices', true);
        $prices = is_array($prices) ? $prices : array();
        $total = (float) get_post_meta($id, 'ori_price', true);
        $adjustment = (float) get_post_meta($id, 'admin_backend_adjustment', true);
        if (!empty($prices['booking_fee_price'])) $total = $total + $adjustment - (float) $prices['booking_fee_price'];
        $final = max(0, (float) STPrice::getTotalPriceWithTaxInOrder($total + $adjustment, $id) - (float) ($prices['coupon_price'] ?? 0));
        $status = $value->type === 'normal_booking' ? (string) get_post_meta($value->order_item_id, 'status', true) : (string) $value->status;
        $timestamp = absint(get_post_meta($id, 'check_in_timestamp', true));
        if ($timestamp > 20000000000) $timestamp = (int) floor($timestamp / 1000);
        if (!$timestamp) $timestamp = strtotime((string) get_post_meta($id, 'check_in', true));
        $rows[] = array(
            'date' => $timestamp ? wp_date('Y-m-d', $timestamp, wp_timezone()) : '',
            'total' => round($final, 2),
            'persons' => absint(get_post_meta($id, 'adult_number', true)) + absint(get_post_meta($id, 'child_number', true)) + absint(get_post_meta($id, 'infant_number', true)),
            'status' => html_entity_decode(wp_strip_all_tags((string) ($statuses[$status] ?? ucfirst($status))), ENT_QUOTES, 'UTF-8'),
        );
    }
    return $rows;
}
