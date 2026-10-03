<?php
// Native booking history: JSON only. Never include or execute a page template.
defined('ABSPATH') || exit;

function tripanza_native_booking_trip_context( $order_id, $fallback_item_id = 0 ) {
        $order_id        = absint( $order_id );
        $fallback_item_id = absint( $fallback_item_id );
        $storefront_id   = absint( get_post_meta( $order_id, 'tripanza_storefront_id', true ) );
        $inventory_id    = absint( get_post_meta( $order_id, 'tripanza_inventory_trip_id', true ) );
        $host_id         = absint( get_post_meta( $order_id, 'tripanza_selling_host_user_id', true ) );

        /* Older orders may only contain item_id. Recover their relationship
         * without changing the historical booking record. */
        if ( ! $storefront_id && $fallback_item_id && get_post_meta( $fallback_item_id, 'host_parent_trip_id', true ) ) {
            $storefront_id = $fallback_item_id;
        }
        if ( ! $inventory_id ) {
            $source_id = $storefront_id ?: $fallback_item_id;
            $inventory_id = function_exists( 'tripanza_get_inventory_trip_id' )
                ? absint( tripanza_get_inventory_trip_id( $source_id ) )
                : absint( get_post_meta( $source_id, 'host_parent_trip_id', true ) ?: $source_id );
        }
        if ( ! $host_id && $storefront_id && $storefront_id !== $inventory_id ) {
            $host_id = function_exists( 'tripanza_get_selling_host_id' )
                ? absint( tripanza_get_selling_host_id( $storefront_id ) )
                : absint( get_post_field( 'post_author', $storefront_id ) );
        }

        $owner_id = absint( get_post_meta( $order_id, 'tripanza_trip_owner_user_id', true ) );
        if ( ! $owner_id && $inventory_id ) {
            $owner_id = absint( get_post_field( 'post_author', $inventory_id ) );
        }
        $owner_user  = $owner_id ? get_userdata( $owner_id ) : false;
        $owner_brand = $owner_id ? trim( (string) get_user_meta( $owner_id, 'travel_company', true ) ) : '';
        if ( '' === $owner_brand && $owner_user ) {
            $owner_brand = trim( (string) $owner_user->display_name );
        }

        $host_brand = '';
        if ( $host_id ) {
            $host_brand = function_exists( 'tripanza_get_host_storefront_brand' )
                ? trim( (string) tripanza_get_host_storefront_brand( $storefront_id ) )
                : trim( (string) get_user_meta( $host_id, 'travel_company', true ) );
            if ( $host_brand === '' ) {
                $host_user  = get_userdata( $host_id );
                $host_brand = $host_user ? trim( (string) $host_user->display_name ) : '';
            }
        }

        $title_id = $inventory_id ?: $fallback_item_id;
        $title = $title_id ? trim( (string) get_post_field( 'post_title', $title_id, 'raw' ) ) : '';
        if ( $title === '' && $fallback_item_id ) $title = get_the_title( $fallback_item_id );

        $is_host_sale      = $host_id > 0 && $storefront_id > 0 && $storefront_id !== $inventory_id;
        $is_partner_owner  = $owner_user && (bool) array_intersect( array( 'partner', 'host' ), (array) $owner_user->roles );
        $sale_type         = $is_host_sale ? 'host_sale' : ( $is_partner_owner ? 'partner_direct' : 'tripanza_direct' );
        $source_label      = 'host_sale' === $sale_type ? 'Host sale' : ( 'partner_direct' === $sale_type ? 'Partner direct' : 'Tripanza direct' );

        return array(
            'title'          => $title,
            'inventory_id'   => $inventory_id,
            'storefront_id'  => $storefront_id,
            'host_id'        => $host_id,
            'host_brand'     => $host_brand,
            'owner_id'       => $owner_id,
            'owner_brand'    => $owner_brand,
            'sale_type'      => $sale_type,
            'source_label'   => $source_label,
            'is_host_sale'   => $is_host_sale,
            'is_partner_direct' => 'partner_direct' === $sale_type,
            'customer_url'   => get_permalink( $storefront_id ?: $title_id ),
            'inventory_url'  => $inventory_id ? get_permalink( $inventory_id ) : '',
        );
    }

function tripanza_native_booking_revision($id, $item_id = 0) {
    $keys = array('status', 'admin_backend_adjustment', 'data_prices', '_tz_booking_archived', 'st_first_name', 'st_last_name', 'st_phone', 'st_email', 'check_in', 'check_in_timestamp');
    $values = array();
    foreach ($keys as $key) $values[$key] = get_post_meta($id, $key, true);
    $values['item_status'] = get_post_meta($item_id ?: $id, 'status', true);
    return hash('sha256', wp_json_encode($values));
}
function tripanza_native_booking_serialize($row, $statuses) {
    $id = absint($row->wc_order_id ?? 0);
    if (!$id || !in_array(get_post_type($id), array('st_order', 'shop_order'), true)) return null;
    $item = absint($row->st_booking_id ?? 0) ?: absint(get_post_meta($id, 'st_booking_id', true) ?: get_post_meta($id, 'item_id', true));
    if (!$item || get_post_type($item) !== 'st_tours') return null;
    $trip = tripanza_native_booking_trip_context($id, $item);
    $meta = function ($key) use ($id) { return get_post_meta($id, $key, true); };
    $text = function ($key) use ($meta) { $value = $meta($key); return is_scalar($value) ? sanitize_text_field((string) $value) : ''; };
    $prices = $meta('data_prices'); $prices = is_array($prices) ? $prices : array();
    $adjustment = (float) $meta('admin_backend_adjustment');
    $total = (float) $meta('ori_price');
    // Preserve the original financial calculation, including its booking-fee branch.
    if (!empty($prices['booking_fee_price'])) $total = $total + $adjustment - (float) $prices['booking_fee_price'];
    $with_tax = (float) STPrice::getTotalPriceWithTaxInOrder($total + $adjustment, $id);
    $coupon = (float) ($prices['coupon_price'] ?? 0);
    $advance = (float) ($prices['total_price'] ?? 0);
    $total = max(0, $with_tax - $coupon);
    $status_key = ($row->type ?? '') === 'normal_booking' ? (string) get_post_meta(absint($row->order_item_id ?? $id), 'status', true) : (string) ($row->status ?? '');
    $status = sanitize_text_field(wp_strip_all_tags((string) ($statuses[$status_key] ?? ucfirst($status_key))));
    $timestamp = absint($meta('check_in_timestamp'));
    if ($timestamp > 20000000000) $timestamp = (int) floor($timestamp / 1000);
    if (!$timestamp) $timestamp = strtotime($text('check_in'));
    $date = $timestamp ? wp_date('Y-m-d', $timestamp, wp_timezone()) : '';
    $departure = $timestamp ? wp_date('j F Y', $timestamp, wp_timezone()) : $text('check_in');
    if ($text('starttime') !== '') $departure .= ' - ' . $text('starttime');
    $checkout = absint($meta('check_out_timestamp'));
    if ($checkout > 20000000000) $checkout = (int) floor($checkout / 1000);
    if (!$checkout) $checkout = strtotime($text('check_out'));
    $duration = $text('duration');
    if (get_post_meta($item, 'type_tour', true) !== 'daily_tour' && $timestamp && $checkout) {
        $days = max(0, (int) round(($checkout - $timestamp) / DAY_IN_SECONDS));
        $duration = $days ? $days . ($days === 1 ? ' day' : ' days') : '';
    }
    $customer = trim($text('st_first_name') . ' ' . $text('st_last_name'));
    if ($customer === '') $customer = $text('st_name') ?: $text('st_email') ?: trim($text('_billing_first_name') . ' ' . $text('_billing_last_name'));
    $names = $meta('guest_name'); $titles = $meta('guest_title'); $guests = array(); $male = 0; $female = 0;
    foreach (is_array($names) ? $names : array() as $index => $name) {
        if (!is_scalar($name)) continue;
        $title = is_array($titles) && isset($titles[$index]) && is_scalar($titles[$index]) ? (string) $titles[$index] : '';
        if (in_array(strtolower(trim($title)), array('mr', 'mister', 'male'), true)) $male++;
        elseif (in_array(strtolower(trim($title)), array('miss', 'mrs', 'ms', 'mademoiselle', 'female'), true)) $female++;
        $display = function_exists('st_guest_title_to_text') ? st_guest_title_to_text($title) : ucfirst($title);
        $guests[] = sanitize_text_field(trim($display . ' ' . $name));
    }
    $quad = max(0, (int) $meta('adult_number')); $triple = max(0, (int) $meta('child_number')); $twin = max(0, (int) $meta('infant_number'));
    $sharing = array(); foreach (array('Quad' => $quad, 'Triple' => $triple, 'Twin' => $twin) as $label => $qty) if ($qty) $sharing[] = $label . ' ' . $qty;
    $addons = array(); $extras = $meta('extras');
    if (is_array($extras) && isset($extras['value']) && is_array($extras['value'])) {
        foreach ($extras['value'] as $key => $qty) if ((int) $qty > 0) {
            $label = sanitize_text_field((string) ($extras['title'][$key] ?? 'Add-on'));
            $addons[] = array('key' => 'extra:' . $label, 'label' => $label, 'qty' => (int) $qty, 'unit' => 'Person', 'price' => (float) ($extras['price'][$key] ?? 0), 'detail' => '');
        }
    } elseif (is_array($extras)) {
        // Headless orders store extras as named rows rather than Traveler's parallel arrays.
        foreach ($extras as $extra) if (is_array($extra) && !empty($extra['name']) && (int) ($extra['quantity'] ?? 0) > 0) {
            $label = sanitize_text_field((string) $extra['name']);
            $addons[] = array('key' => 'extra:' . $label, 'label' => $label, 'qty' => (int) $extra['quantity'], 'unit' => 'Person', 'price' => (float) ($extra['price'] ?? 0), 'detail' => '');
        }
    }
    foreach (array('hotel', 'activity', 'car', 'flight') as $kind) {
        $packages = $meta('package_' . $kind);
        foreach (is_array($packages) ? $packages : array() as $package) {
            if (!is_array($package) && !is_object($package)) continue;
            $p = (array) $package;
            $name = $kind === 'flight' ? ($p['flight_origin'] ?? '') . ' to ' . ($p['flight_destination'] ?? '') : ($p[$kind . '_name'] ?? '');
            $qty = $kind === 'flight' ? 1 : max(1, (int) ($p[$kind === 'car' ? 'car_quantity' : 'qty'] ?? 1));
            $label = ucfirst($kind) . ': ' . sanitize_text_field((string) $name);
            $addons[] = array('key' => $kind . ':' . $name, 'label' => $label, 'qty' => $qty, 'unit' => '', 'price' => (float) ($p[$kind . '_price'] ?? 0), 'detail' => $kind === 'flight' ? sanitize_text_field(($p['flight_departure_time'] ?? '') . ' / ' . ($p['flight_duration'] ?? '')) : '');
        }
    }
    $currency = strtoupper($text('currency')) ?: 'INR'; if (!preg_match('/^[A-Z]{3}$/D', $currency)) $currency = 'INR';
    $trip_label = $trip['title'] . ' — ' . $trip['source_label'];
    if ($trip['is_host_sale']) $trip_label .= ': ' . $trip['host_brand']; elseif ($trip['is_partner_direct']) $trip_label .= ': ' . $trip['owner_brand'];
    $archived_at = $text('_tz_booking_archived_at');
    return array(
        'id' => $id, 'item_id' => absint($row->order_item_id ?? $id), 'revision' => tripanza_native_booking_revision($id, absint($row->order_item_id ?? $id)),
        'editable' => get_post_type($id) === 'st_order' && ($row->type ?? '') === 'normal_booking' && absint($row->order_item_id ?? $id) === $id,
        'archived' => $meta('_tz_booking_archived') === '1', 'archived_at' => $archived_at,
        'date' => $date, 'departure' => $departure, 'checkout' => $checkout ? wp_date('Y-m-d', $checkout, wp_timezone()) : '', 'duration' => $duration,
        'title' => sanitize_text_field($trip['title']), 'trip_label' => sanitize_text_field($trip_label), 'source' => $trip['source_label'], 'poster' => $trip['sale_type'] === 'tripanza_direct' ? 'admin' : 'host',
        'host' => sanitize_text_field($trip['host_brand']), 'owner' => sanitize_text_field($trip['owner_brand']), 'inventory_id' => $trip['inventory_id'], 'storefront_id' => $trip['storefront_id'],
        'trip_url' => esc_url_raw($trip['customer_url']), 'inventory_url' => esc_url_raw($trip['inventory_url']),
        'edit_url' => esc_url_raw(add_query_arg('order_id', $id, home_url('/single-booking-edit/'))),
        'invoice_url' => esc_url_raw(function_exists('tripanza_invoice_download_url') ? tripanza_invoice_download_url($id) : home_url(user_trailingslashit('booking-invoice/' . $id))),
        'customer' => $customer, 'email' => sanitize_email($text('st_email')), 'phone' => $text('st_country_code') . $text('st_phone'), 'guests' => $guests,
        'male' => $male, 'female' => $female, 'quad' => $quad, 'triple' => $triple, 'twin' => $twin, 'persons' => $quad + $triple + $twin, 'sharing' => $sharing ? implode(', ', $sharing) : 'Not specified', 'addons' => $addons,
        'currency' => $currency, 'total' => round($total, 2), 'advance' => round($advance, 2), 'balance' => round($with_tax - $advance - $coupon, 2), 'adjustment' => $adjustment,
        'status_key' => $status_key, 'status' => $status, 'payment_status' => $text('payment_status'), 'transaction_id' => $text('transaction_id'), 'transaction_date' => $text('transaction_date'),
        'note' => $text('st_note'), 'boarding' => $text('boarding_location') ?: $text('address'), 'dropoff' => $text('dropoff_location') ?: $text('_st_tour_dropoff'),
    );
}
function tripanza_native_booking_ready() {
    return is_callable(array('STUser_f', 'get_history_bookings')) && is_callable(array('STUser_f', '_get_order_statuses')) && is_callable(array('STPrice', 'getTotalPriceWithTaxInOrder'));
}
function tripanza_native_booking_row($id) {
    global $wpdb;
    if (get_post_type($id) !== 'st_order') return null; // Legacy WooCommerce bookings remain read-only; use the existing full editor.
    $table = $wpdb->prefix . 'st_order_item_meta';
    $exists = $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $wpdb->esc_like($table)));
    $row = $exists === $table ? $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE wc_order_id = %d AND st_booking_post_type = 'st_tours' LIMIT 1", $id)) : null;
    if (!$row) $row = (object) array('wc_order_id' => $id, 'order_item_id' => $id, 'st_booking_id' => absint(get_post_meta($id, 'st_booking_id', true) ?: get_post_meta($id, 'item_id', true)), 'type' => 'normal_booking');
    return ($row->type ?? '') === 'normal_booking' && absint($row->order_item_id ?? $id) === $id ? $row : null;
}
function tripanza_native_booking_get(WP_REST_Request $request) {
    if (!tripanza_native_booking_ready()) return tripanza_native_admin_error('Traveler booking services are unavailable.', 503);
    $page = max(1, min(10000, absint($request->get_param('page') ?: 1))); $limit = 1000;
    $history = STUser_f::get_history_bookings('st_tours', ($page - 1) * $limit, $limit, get_current_user_id());
    if (!is_array($history) || !isset($history['rows'])) return tripanza_native_admin_error('Traveler could not load booking history.', 503);
    $rows = array(); $statuses = STUser_f::_get_order_statuses(); $statuses = is_array($statuses) ? array_map('sanitize_text_field', $statuses) : array();
    $ids = array(); foreach ((array) $history['rows'] as $row) $ids[] = absint($row->wc_order_id ?? 0);
    update_meta_cache('post', $ids);
    foreach ((array) $history['rows'] as $row) { $booking = tripanza_native_booking_serialize($row, $statuses); if ($booking && !$booking['archived']) $rows[] = $booking; }
    $archive_query = new WP_Query(array('post_type' => array('st_order', 'shop_order'), 'post_status' => 'any', 'posts_per_page' => $limit, 'paged' => $page, 'orderby' => 'ID', 'order' => 'DESC', 'meta_key' => '_tz_booking_archived', 'meta_value' => '1'));
    // One item-table query for the archive page, not 1,000 individual lookups.
    global $wpdb;
    $archive_map = array(); $archive_ids = wp_list_pluck($archive_query->posts, 'ID');
    $table = $wpdb->prefix . 'st_order_item_meta';
    $exists = $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $wpdb->esc_like($table)));
    if ($archive_ids && $exists === $table) {
        $placeholders = implode(',', array_fill(0, count($archive_ids), '%d'));
        $archive_items = $wpdb->get_results($wpdb->prepare("SELECT * FROM {$table} WHERE wc_order_id IN ({$placeholders}) AND st_booking_post_type = 'st_tours'", $archive_ids));
        foreach ((array) $archive_items as $archive_item) $archive_map[(int) $archive_item->wc_order_id] = $archive_item;
    }
    $archived = array();
    foreach ($archive_query->posts as $post) {
        $row = $archive_map[$post->ID] ?? null;
        if (!$row) $row = (object) array('wc_order_id' => $post->ID, 'order_item_id' => $post->ID, 'st_booking_id' => absint(get_post_meta($post->ID, 'st_booking_id', true)), 'type' => 'normal_booking');
        $booking = tripanza_native_booking_serialize($row, $statuses); if ($booking) $archived[] = $booking;
    }
    $user = wp_get_current_user();
    return tripanza_native_admin_response(array('bookings_api_version' => '1.0.0', 'user' => array('name' => $user->display_name), 'nonce' => wp_create_nonce('tripanza_native_bookings'), 'today' => current_time('Y-m-d'), 'rows' => $rows, 'archived' => $archived, 'statuses' => $statuses, 'total' => (int) ($history['total'] ?? count($rows)), 'archive_total' => (int) $archive_query->found_posts, 'page' => $page, 'per_page' => $limit, 'mail_available' => is_callable(array('STCart', 'send_mail_after_booking'))));
}
function tripanza_native_booking_mail($id) {
    if (!is_email(get_post_meta($id, 'st_email', true))) return 'No valid email exists for this booking.';
    if (!is_callable(array('STCart', 'send_mail_after_booking'))) return 'Traveler booking mail is unavailable.';
    try { $sent = STCart::send_mail_after_booking($id); return $sent === false ? 'Traveler could not send the booking email.' : ''; }
    catch (Throwable $error) { error_log('Tripanza booking mail: ' . $error->getMessage()); return 'The booking was saved, but its email could not be sent.'; }
}
function tripanza_native_booking_post(WP_REST_Request $request) {
    if (!tripanza_native_booking_ready()) return tripanza_native_admin_error('Traveler booking services are unavailable.', 503);
    $data = $request->get_json_params();
    if (!is_array($data) || !isset($data['nonce']) || !is_string($data['nonce']) || !wp_verify_nonce($data['nonce'], 'tripanza_native_bookings')) return tripanza_native_admin_error('Your booking session expired. Refresh and try again.', 403);
    $action = $data['action'] ?? ''; if (!is_string($action) || !in_array($action, array('status', 'adjustment', 'resend', 'archive', 'restore', 'purge'), true)) return tripanza_native_admin_error('Action not allowed.');
    $bulk = in_array($action, array('archive', 'restore', 'purge'), true);
    if ($bulk && (!isset($data['ids']) || !is_array($data['ids']) || count($data['ids']) < 1 || count($data['ids']) > 1000)) return tripanza_native_admin_error('Select between 1 and 1000 bookings.');
    $ids = $bulk ? $data['ids'] : array($data['id'] ?? 0);
    foreach ($ids as $id) if ((!is_int($id) && !is_string($id)) || !ctype_digit((string) $id) || (int) $id < 1) return tripanza_native_admin_error('Invalid booking ID.');
    $ids = array_values(array_unique(array_map('absint', $ids)));
    if ($action === 'purge' && ($data['confirmation'] ?? '') !== 'DELETE PERMANENTLY') return tripanza_native_admin_error('Permanent deletion requires explicit confirmation.');
    $saved = array(); $failed = array(); $updated = array(); $warning = ''; $statuses = STUser_f::_get_order_statuses();
    foreach ($ids as $id) {
        // Atomic, short-lived per-booking lock prevents simultaneous admin edits.
        $lock = 'tripanza_native_booking_lock_' . $id;
        $stamp = time();
        if (!add_option($lock, $stamp, '', false)) {
            $previous = (int) get_option($lock);
            if ($previous && $previous < time() - 120) delete_option($lock);
            $failed[] = $id; continue;
        }
        try {
            $row = tripanza_native_booking_row($id);
            $booking = $row ? tripanza_native_booking_serialize($row, $statuses) : null;
            if (!$booking) { $failed[] = $id; continue; }
            if (!$bulk && (!isset($data['revision']) || !is_string($data['revision']) || !hash_equals($booking['revision'], $data['revision']))) return tripanza_native_admin_error('This booking changed. Refresh before editing it again.', 409);
            if (($action === 'status' || $action === 'adjustment') && $booking['archived']) return tripanza_native_admin_error('Restore this booking before editing it.', 409);
            if ($action === 'status') {
                $status = $data['status'] ?? ''; if (!is_string($status) || !isset($statuses[$status])) return tripanza_native_admin_error('Choose a valid booking status.');
                if ($booking['status_key'] !== $status) {
                    update_post_meta($booking['item_id'], 'status', $status);
                    if (get_post_meta($booking['item_id'], 'status', true) !== $status) return tripanza_native_admin_error('The status could not be saved.', 500);
                    $warning = tripanza_native_booking_mail($booking['item_id']);
                }
            } elseif ($action === 'adjustment') {
                $amount = $data['amount'] ?? null;
                if (!is_scalar($amount) || !preg_match('/^[-+]?[0-9]+(?:\.[0-9]{1,2})?$/D', (string) $amount) || abs((float) $amount) > 100000000) return tripanza_native_admin_error('Enter a valid adjustment with at most two decimal places.');
                update_post_meta($id, 'admin_backend_adjustment', (float) $amount);
                if ((float) get_post_meta($id, 'admin_backend_adjustment', true) !== (float) $amount) return tripanza_native_admin_error('The adjustment could not be saved.', 500);
            } elseif ($action === 'resend') {
                $warning = tripanza_native_booking_mail($booking['item_id']);
                if ($warning) return tripanza_native_admin_error($warning, 502);
            } elseif ($action === 'archive') {
                if (!$booking['archived']) {
                    update_post_meta($id, '_tz_booking_archived', '1'); update_post_meta($id, '_tz_booking_archived_at', current_time('mysql')); update_post_meta($id, '_tz_booking_archived_by', get_current_user_id());
                }
                if (get_post_meta($id, '_tz_booking_archived', true) !== '1') { $failed[] = $id; continue; }
            } elseif ($action === 'restore') {
                if (!$booking['archived']) { $failed[] = $id; continue; }
                delete_post_meta($id, '_tz_booking_archived'); delete_post_meta($id, '_tz_booking_archived_at'); delete_post_meta($id, '_tz_booking_archived_by');
                if (get_post_meta($id, '_tz_booking_archived', true) === '1') { $failed[] = $id; continue; }
            } elseif ($action === 'purge') {
                if (!$booking['archived'] || !wp_delete_post($id, true)) { $failed[] = $id; continue; }
            }
            $saved[] = $id;
            if ($action !== 'purge') $updated[] = tripanza_native_booking_serialize($row, $statuses);
        } finally { delete_option($lock); }
    }
    if (!$saved) return tripanza_native_admin_error('No changes saved. The selected bookings are unavailable, legacy WooCommerce bookings, or currently being edited.', 409);
    return tripanza_native_admin_response(array('ok' => true, 'ids' => $saved, 'failed_ids' => $failed, 'rows' => $updated, 'warning' => $warning, 'nonce' => wp_create_nonce('tripanza_native_bookings'), 'message' => $action === 'resend' ? 'Booking email sent.' : count($saved) . ' booking(s) updated.' . ($failed ? ' Some bookings could not be changed.' : '')));
}
add_action('rest_api_init', function () {
    register_rest_route('tripanza-headless/v1', '/admin/bookings', array(
        array('methods' => 'GET', 'permission_callback' => 'tripanza_native_admin_permission', 'callback' => 'tripanza_native_booking_get'),
        array('methods' => 'POST', 'permission_callback' => 'tripanza_native_admin_permission', 'callback' => 'tripanza_native_booking_post'),
    ));
});
