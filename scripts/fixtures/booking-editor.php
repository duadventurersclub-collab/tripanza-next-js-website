<?php
// Isolated PHP execution fixture, not WordPress or a real database. Never install this file.
define('ABSPATH', '/'); define('ARRAY_A', 'ARRAY_A');
class WP_Error { public $message; public $status; function __construct($message, $status) { $this->message = $message; $this->status = $status; } }
class WP_REST_Request implements ArrayAccess {
    public $input; function __construct($input) { $this->input = $input; }
    function get_json_params() { return $this->input; }
    #[ReturnTypeWillChange] function offsetGet($key) { return 101; }
    #[ReturnTypeWillChange] function offsetExists($key) { return true; }
    #[ReturnTypeWillChange] function offsetSet($key, $value) {}
    #[ReturnTypeWillChange] function offsetUnset($key) {}
}
function is_wp_error($v) { return $v instanceof WP_Error; }
function tripanza_native_admin_error($message, $status = 400) { return new WP_Error($message, $status); }
function tripanza_native_admin_response($data) { return $data; }
function absint($v) { return abs((int) $v); }
function sanitize_text_field($v) { return trim(strip_tags($v)); }
function sanitize_textarea_field($v) { return trim(strip_tags($v)); }
function sanitize_key($v) { return strtolower(preg_replace('/[^a-zA-Z0-9_-]/', '', $v)); }
function sanitize_title($v) { return strtolower(str_replace(' ', '-', $v)); }
function wp_json_encode($v) { return json_encode($v); }
function wp_slash($v) { return $v; }
function wp_strip_all_tags($v) { return strip_tags($v); }
function is_email($v) { return filter_var($v, FILTER_VALIDATE_EMAIL); }
function wp_timezone() { return new DateTimeZone('Asia/Kolkata'); }
function wp_date($format, $timestamp, $zone = null) { return (new DateTimeImmutable('@' . $timestamp))->setTimezone($zone ?: wp_timezone())->format($format); }
function current_time($v) { return $v === 'mysql' ? '2026-10-04 12:00:00' : time(); }
function get_post_meta($id, $key = '', $single = false) { global $meta; if ($key === '') return array_map(function ($v) { return array($v); }, $meta[$id] ?? array()); return $meta[$id][$key] ?? ''; }
function update_post_meta($id, $key, $v) { global $meta; $meta[$id][$key] = $v; return true; }
function metadata_exists($type, $id, $key) { global $meta; return array_key_exists($key, $meta[$id] ?? array()); }
function add_post_meta($id, $key, $value, $unique) { if (metadata_exists('post', $id, $key)) return false; return update_post_meta($id, $key, $value); }
function delete_post_meta($id, $key) { global $meta; unset($meta[$id][$key]); }
function add_option($key, $v, $deprecated = '', $autoload = false) { global $options; if (isset($options[$key])) return false; $options[$key] = $v; return true; }
function get_option($key) { global $options; return $options[$key] ?? ''; }
function delete_option($key) { global $options; unset($options[$key]); }
function get_post($id) { return in_array($id, array(10, 11, 101), true) ? (object) array('ID' => $id, 'post_type' => $id === 101 ? 'st_order' : 'st_tours', 'post_status' => 'publish') : null; }
function get_post_type($id) { return $id === 101 ? 'st_order' : 'st_tours'; }
function get_post_field($field, $id) { return 7; }
function get_the_title($id) { return $id === 11 ? 'Spiti Valley' : 'Manali'; }
function get_permalink($id) { return 'https://fixture.test/tour/' . $id; }
function get_post_time($format, $gmt, $id) { return '4 Oct 2026'; }
function wp_get_current_user() { return (object) array('display_name' => 'Fixture Admin'); }
function get_current_user_id() { return 1; }
function clean_post_cache($id) {}
function wp_cache_delete($id, $group) {}
function wp_create_nonce($action) { return 'fixture-nonce'; }
function wp_verify_nonce($nonce, $action) { return $nonce === 'fixture-nonce'; }
function esc_url_raw($url) { return $url; }
function home_url($path) { return 'https://fixture.test' . $path; }
function add_query_arg($args, $url) { return $url . '?' . http_build_query($args); }
function add_action($name, $callback) {}
function tripanza_native_admin_valid_date($date) { $d = DateTimeImmutable::createFromFormat('!Y-m-d', $date); return $d && $d->format('Y-m-d') === $date; }
class STUser_f { static function _get_order_statuses() { return array('partial' => 'Partially Paid', 'complete' => 'Fully Paid', 'cancelled' => 'Cancelled'); } }
class STPrice { static function getTotalPriceWithTaxInOrder($amount, $id) { return $amount * 1.05; } }
class STCart { static function send_mail_after_booking($id) {} }
function tripanza_native_booking_ready() { return true; }
function tripanza_native_booking_row($id) { return (object) array('st_booking_id' => get_post_meta($id, 'item_id', true), 'order_item_id' => $id); }
function tripanza_native_booking_serialize($row, $statuses) { $v = tripanza_native_editor_financial_summary(101, get_post_meta(101, 'data_prices', true)); return array('id' => 101, 'editable' => true, 'archived' => false, 'status_key' => $v['status'], 'status' => $statuses[$v['status']], 'host' => '', 'source' => 'Tripanza direct', 'owner' => 'Tripanza', 'currency' => 'INR'); }
function tripanza_native_booking_mail($id) { global $mail; $mail++; return ''; }
function tripanza_send_whatsapp($phone, $message) { global $whatsapp; $whatsapp++; return true; }
function get_user_meta($id, $key, $single) { global $users; return $users[$id][$key] ?? ''; }
function update_wallet_balance($id, $amount, $reason, $type, $source) { global $users, $credits; $credits++; $users[$id]['wallet_balance'] += $amount; return $users[$id]['wallet_balance']; }
class FixtureDB {
    public $posts = 'wp_posts'; public $postmeta = 'wp_postmeta'; public $prefix = 'wp_'; public $usermeta = 'wp_usermeta'; public $fail = false; public $engine = 'InnoDB'; public $snapshot;
    function prepare($sql, ...$params) { return $sql; }
    function esc_like($v) { return $v; }
    function get_row($sql, $format = null) { return array('Engine' => $this->engine); }
    function query($sql) { global $meta, $users, $items; if ($sql === 'START TRANSACTION') $this->snapshot = array($meta, $users, $items); if ($sql === 'ROLLBACK') list($meta, $users, $items) = $this->snapshot; return 1; }
    function update($table, $values, $where, $formats, $where_formats) { global $items; if ($this->fail) return false; $items = array_replace($items, $values); return 1; }
}
$wpdb = new FixtureDB(); $options = array(); $users = array(7 => array('wallet_balance' => 100)); $items = array(); $mail = 0; $whatsapp = 0; $credits = 0;
$meta = array(101 => array('item_id' => 10, 'st_booking_id' => 10, 'status' => 'partial', 'st_tax_percent' => 5, 'adult_number' => 2, 'child_number' => 0, 'infant_number' => 0, 'adult_price' => 1000, 'child_price' => 1200, 'infant_price' => 1500, 'discount_rate' => 10, 'st_email' => 'guest@example.test', 'st_first_name' => 'Fixture', 'st_last_name' => 'Guest', 'check_in' => '2026-10-12', 'check_out' => '2026-10-15', 'data_prices' => array('total_price_with_tax' => 2000, 'total_price' => 500, 'deposit_price' => 500, 'coupon_price' => 100), 'extras' => array('title' => array('Rafting'), 'price' => array(100), 'value' => array(2)), 'raw_data' => '{"guest_name":["Guest"]}', 'item_data' => array('id' => 10), 'st_cart_info' => array(10 => array('data' => array('data_price' => array('total_price' => 1800)), 'price' => 2000)), 'tripanza_wallet_used' => 100, 'tripanza_wallet_debited' => 1), 10 => array('discount_by_adult' => array(array('key' => 3, 'value' => 5))), 11 => array());
require '/booking-editor.php';
function check($test, $message) { if (!$test) throw new RuntimeException($message); }
function post_request($action, $extra = array(), $key = null, $revision = null) { $data = tripanza_native_editor_load(101); return tripanza_native_editor_post(new WP_REST_Request(array_merge(array('action' => $action, 'nonce' => 'fixture-nonce', 'revision' => $revision ?? $data['revision'], 'request_id' => $key ?? bin2hex(random_bytes(12))), $extra))); }
$before = tripanza_native_editor_load(101); $fields = $before['fields']; $fields['adult_number'] = 3; $fields['addons'][0]['quantity'] = 3; $fields['selected_tour_id'] = 11; $fields['boarding'] = "Guest's boarding"; $fields['departure_date'] = '2026-11-01'; $fields['return_date'] = '2026-11-04';
check(tripanza_native_editor_financial_summary(101, get_post_meta(101, 'data_prices', true), -.1)['final_total'] === 1999.89, 'Negative half-cent GST rounds away from zero');
$manual = array('type' => 'charge', 'amount' => 100, 'reason' => 'Room upgrade', 'internal_note' => 'Fixture note'); $key = 'fixture-save-request-0001';
$saved = post_request('save', array('fields' => $fields, 'manual' => $manual), $key, $before['revision']); check(!is_wp_error($saved), 'Save must succeed');
check(abs($saved['editor']['financials']['final_total'] - 3013.25) < .001, 'Sale/group/add-on delta plus manual GST must match');
check($meta[101]['data_prices']['total_price_with_tax'] === 2000 && $meta[101]['data_prices']['coupon_price'] === 100, 'Checkout snapshot and coupon must remain immutable');
check($items['st_booking_id'] === 11 && $items['check_in'] === '2026-11-01', 'Traveler item dates/tour must synchronize');
check($meta[101]['item_data']['id'] === 11 && json_decode($meta[101]['raw_data'], true)['id'] === 11 && isset($meta[101]['st_cart_info'][11]), 'All item references must synchronize');
check(get_post_meta(11, 'address', true) === '', 'Do not change tour locations');
$duplicate = post_request('save', array('fields' => $fields, 'manual' => $manual), $key, $before['revision']); check(!is_wp_error($duplicate) && count($meta[101]['tripanza_manual_adjustment_ledger']) === 1, 'Lost-response retry must not apply a charge twice');
$stale = post_request('save', array('fields' => $fields, 'manual' => $manual), null, $before['revision']); check(is_wp_error($stale) && $stale->status === 409, 'Stale revision must reject writes');
$before_failure = $meta; $wpdb->fail = true; $fields = tripanza_native_editor_load(101)['fields']; $fields['boarding'] = 'Must roll back';
$failed = post_request('save', array('fields' => $fields, 'manual' => $manual)); check(is_wp_error($failed) && $meta === $before_failure, 'Injected Traveler failure must roll back all metadata/ledger/receipts'); $wpdb->fail = false;
$wpdb->engine = 'MyISAM'; $failed = post_request('save', array('fields' => $fields, 'manual' => $manual)); check(is_wp_error($failed) && $failed->status === 503 && $meta === $before_failure, 'Non-transactional storage must not write'); $wpdb->engine = 'InnoDB';
$fields = tripanza_native_editor_load(101)['fields']; $fields['total_price'] = 0; $manual['amount'] = 0;
$zero = post_request('save', array('fields' => $fields, 'manual' => $manual)); check(!is_wp_error($zero) && $zero['editor']['financials']['amount_paid'] === 0.0, 'Explicit zero payment must not resurrect the old deposit');
$fields['return_date'] = '2020-01-01'; $invalid = post_request('save', array('fields' => $fields, 'manual' => $manual)); check(is_wp_error($invalid) && $invalid->status === 422, 'Reversed dates must reject');
$reverse = post_request('reverse_wallet', array('confirmation' => 'REVERSE WALLET')); check(!is_wp_error($reverse) && $users[7]['wallet_balance'] === 200.0 && $credits === 1, 'Wallet restores debit once');
$again = post_request('reverse_wallet', array('confirmation' => 'REVERSE WALLET')); check(!is_wp_error($again) && $credits === 1, 'Repeated wallet reversal must not credit twice');
check(!is_wp_error(post_request('status', array('status' => 'complete'))) && tripanza_native_editor_load(101)['financials']['balance'] === 0.0, 'Closed booking has no balance');
check(!is_wp_error(post_request('resend')) && $mail === 2, 'Mail sent only on explicit status/resend actions');
check(!is_wp_error(post_request('whatsapp', array('phone' => '+91 98765 43210'))) && $whatsapp === 1, 'Explicit WhatsApp action only');
$meta[101]['wc_order_id'] = 999; check(is_wp_error(post_request('status', array('status' => 'partial'))), 'WooCommerce-linked bookings are read-only');
check(tripanza_native_editor_normalize_date('31/02/2026') === '' && tripanza_native_editor_normalize_date('12/10/2026') === '2026-10-12', 'Strict timezone date normalization');
echo "PASS PHP execution: pricing, immutable snapshot, metadata/table synchronization, retries, stale writes, rollback, storage guards, zero payments, dates, wallet-once, status/email/WhatsApp, WooCommerce protection\n";
