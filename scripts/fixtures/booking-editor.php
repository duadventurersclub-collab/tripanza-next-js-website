<?php
// Isolated PHP execution fixture, not WordPress or a real database. Never install this file.
define('ABSPATH', '/'); define('ARRAY_A', 'ARRAY_A'); define('DAY_IN_SECONDS', 86400);
class WP_Error { public $message; public $status; public $data; function __construct($message, $status, $data = null) { $this->message = $data === null ? $message : $status; $this->status = $data === null ? $status : $data['status']; $this->data = $data; } function get_error_message() { return $this->message; } }
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
function sanitize_email($v) { return filter_var($v, FILTER_SANITIZE_EMAIL); }
function sanitize_key($v) { return strtolower(preg_replace('/[^a-zA-Z0-9_-]/', '', $v)); }
function sanitize_title($v) { return strtolower(str_replace(' ', '-', $v)); }
function maybe_unserialize($v) { if (!is_string($v)) return $v; $unserialized = @unserialize($v); return $unserialized === false ? $v : $unserialized; }
function wp_json_encode($v) { return json_encode($v); }
function wp_slash($v) { return $v; }
function wp_strip_all_tags($v) { return strip_tags($v); }
function is_email($v) { return filter_var($v, FILTER_VALIDATE_EMAIL); }
function wp_timezone() { return new DateTimeZone('Asia/Kolkata'); }
function wp_date($format, $timestamp, $zone = null) { return (new DateTimeImmutable('@' . $timestamp))->setTimezone($zone ?: wp_timezone())->format($format); }
function current_time($v) { return $v === 'mysql' ? '2026-10-04 12:00:00' : ($v === 'Y-m-d' ? '2026-10-04' : time()); }
function get_post_meta($id, $key = '', $single = false) { global $meta; if ($key === '') return array_map(function ($v) { return array($v); }, $meta[$id] ?? array()); return $meta[$id][$key] ?? ''; }
function update_post_meta($id, $key, $v) { global $meta; $meta[$id][$key] = $v; return true; }
function metadata_exists($type, $id, $key) { global $meta; return array_key_exists($key, $meta[$id] ?? array()); }
function add_post_meta($id, $key, $value, $unique = false) { if ($unique && metadata_exists('post', $id, $key)) return false; return update_post_meta($id, $key, $value); }
function delete_post_meta($id, $key) { global $meta; unset($meta[$id][$key]); }
function add_option($key, $v, $deprecated = '', $autoload = false) { global $options; if (isset($options[$key])) return false; $options[$key] = $v; return true; }
function get_option($key, $default = '') { global $options; return $options[$key] ?? $default; }
function update_option($key, $value, $autoload = null) { global $options; $options[$key] = $value; return true; }
function delete_option($key) { global $options; unset($options[$key]); }
function get_post($id) { global $posts; if (isset($posts[$id])) return (object) array_merge($posts[$id], array('ID' => $id)); return in_array($id, array(10, 11, 101), true) ? (object) array('ID' => $id, 'post_type' => $id === 101 ? 'st_order' : 'st_tours', 'post_status' => 'publish') : null; }
function get_post_type($id) { $post = get_post($id); return $post ? $post->post_type : false; }
function get_post_field($field, $id) { return 7; }
function get_userdata($id) { return (object) array('display_name' => 'Tripanza', 'roles' => array('administrator')); }
function get_user_by($field, $value) { return false; }
function get_the_title($id) { global $posts; return $posts[$id]['post_title'] ?? ($id === 11 ? 'Spiti Valley' : 'Manali'); }
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
function add_query_arg($args, $url, $target = null) { if ($target !== null) { $args = array($args => $url); $url = $target; } return $url . '?' . http_build_query($args); }
function user_trailingslashit($path) { return rtrim($path, '/') . '/'; }
function add_action($name, $callback, $priority = 10, $accepted_args = 1) { global $hooks; $hooks[$name][] = $callback; }
function remove_action($name, $callback, $priority = 10) { global $hooks; $hooks[$name] = array_values(array_filter($hooks[$name] ?? array(), function ($item) use ($callback) { return $item !== $callback; })); }
function do_action($name, ...$args) { global $hooks; foreach ($hooks[$name] ?? array() as $callback) $callback(...$args); }
function apply_filters($name, $value) { return $value; }
function post_type_exists($type) { return true; }
function tripanza_native_admin_permission() { global $permission_denied; return $permission_denied ? tripanza_native_admin_error('Admin required.', 403) : true; }
function get_users($args) { return array(7); }
function get_posts($args) { global $posts, $meta; if (isset($args['meta_key'])) { $result = array(); foreach ($meta as $id => $values) if (($values[$args['meta_key']] ?? '') === $args['meta_value'] && get_post_type($id) === 'st_order') $result[] = get_post($id); return $result; } return array(get_post(10), get_post(11)); }
function wp_insert_post($data, $error = false) { global $posts, $next_post_id; $id = ++$next_post_id; $posts[$id] = $data; return $id; }
function wp_generate_password($length, $special = false, $extra = false) { return str_repeat('a', $length); }
function tripanza_native_admin_valid_date($date) { $d = DateTimeImmutable::createFromFormat('!Y-m-d', $date); return $d && $d->format('Y-m-d') === $date; }
class STUser_f { static function get_history_bookings() { return array(); } static function _get_order_statuses() { return array('partial' => 'Partially Paid', 'complete' => 'Fully Paid', 'completed' => 'Completed', 'fully_paid' => 'Fully Paid', 'refunded' => 'Refunded', 'canceled' => 'Canceled', 'cancelled' => 'Cancelled', 'pending' => 'Pending', 'on-hold' => 'On Hold', 'incomplete' => 'Incomplete'); } }
class STPrice { static function getTotalPriceWithTaxInOrder($amount, $id) { return $amount * 1.05; } }
class STCart { static function send_mail_after_booking($id) { global $mail, $mail_failure; $mail++; if ($mail_failure) throw new RuntimeException('Injected mail failure'); } }
function tripanza_send_whatsapp($phone, $message) { global $whatsapp; $whatsapp++; return true; }
function get_user_meta($id, $key, $single) { global $users; return $users[$id][$key] ?? ''; }
function update_wallet_balance($id, $amount, $reason, $type, $source) { global $users, $credits; $credits++; $users[$id]['wallet_balance'] += $amount; return $users[$id]['wallet_balance']; }
class FixtureDB {
    public $posts = 'wp_posts'; public $postmeta = 'wp_postmeta'; public $prefix = 'wp_'; public $usermeta = 'wp_usermeta'; public $fail = false; public $engine = 'InnoDB'; public $snapshot;
    function prepare($sql, ...$params) { return $sql; }
    function esc_like($v) { return $v; }
    function get_var($sql) { global $creation_storage; return $creation_storage && strpos($sql, 'SHOW TABLES') !== false ? 'wp_st_order_item_meta' : null; }
    function get_row($sql, $format = null) { return strpos($sql, 'SHOW TABLE STATUS') === 0 ? array('Engine' => $this->engine) : null; }
    function query($sql) { global $meta, $users, $items, $posts; if ($sql === 'START TRANSACTION') $this->snapshot = array($meta, $users, $items, $posts); if ($sql === 'ROLLBACK') list($meta, $users, $items, $posts) = $this->snapshot; return 1; }
    function insert($table, $values, $formats = null) { global $items; if ($this->fail) return false; $items[$values['order_item_id']] = $values; return 1; }
    function update($table, $values, $where, $formats, $where_formats) { global $items; if ($this->fail) return false; $items = array_replace($items, $values); return 1; }
}
$wpdb = new FixtureDB(); $options = array(); $users = array(7 => array('wallet_balance' => 100)); $items = array(); $mail = 0; $whatsapp = 0; $credits = 0;
$meta = array(101 => array('item_id' => 10, 'st_booking_id' => 10, 'status' => 'partial', 'st_tax_percent' => 5, 'adult_number' => 2, 'child_number' => 0, 'infant_number' => 0, 'adult_price' => 1000, 'child_price' => 1200, 'infant_price' => 1500, 'discount_rate' => 10, 'st_email' => 'guest@example.test', 'st_first_name' => 'Fixture', 'st_last_name' => 'Guest', 'check_in' => '2026-10-12', 'check_out' => '2026-10-15', 'data_prices' => array('total_price_with_tax' => 2000, 'total_price' => 500, 'deposit_price' => 500, 'coupon_price' => 100), 'extras' => array('title' => array('Rafting'), 'price' => array(100), 'value' => array(2)), 'raw_data' => '{"guest_name":["Guest"]}', 'item_data' => array('id' => 10), 'st_cart_info' => array(10 => array('data' => array('data_price' => array('total_price' => 1800)), 'price' => 2000)), 'tripanza_wallet_used' => 100, 'tripanza_wallet_debited' => 1), 10 => array('discount_by_adult' => array(array('key' => 3, 'value' => 5))), 11 => array());
require '/bookings.php'; require '/booking-editor.php';
function check($test, $message) { if (!$test) throw new RuntimeException($message); }
// Read real history serialization and editor data from the same saved order.
// A completed advance payment is not evidence that the trip balance was paid.
$balance_snapshot = $meta;
foreach (array('partial', 'pending', 'on-hold', 'incomplete', 'complete', 'completed') as $balance_status) {
    $meta[101]['status'] = $balance_status;
    $editor = tripanza_native_editor_load(101);
    check($editor['financials']['balance'] === 1500.0, $balance_status . ': editor must retain unpaid trip balance');
    check($editor['booking']['balance'] === 1500.0 && $editor['booking']['total'] === 2000.0 && $editor['booking']['advance'] === 500.0, $balance_status . ': history must agree with editor');
}
check($meta[101]['data_prices'] === $balance_snapshot[101]['data_prices'], 'Balance reads must not mutate stored payment amounts');
foreach (array('fully_paid', 'refunded', 'canceled', 'cancelled') as $balance_status) {
    $meta[101]['status'] = $balance_status;
    check(tripanza_native_editor_load(101)['financials']['balance'] === 0.0, $balance_status . ': preserve reference closed-status handling');
}
$meta[101]['status'] = 'complete';
$meta[101]['data_prices']['total_price'] = 2000;
check((float) tripanza_native_editor_load(101)['financials']['balance'] === 0.0, 'Actually paid in full must show zero balance');
$meta[101]['data_prices']['total_price'] = 2100;
$overpaid = tripanza_native_editor_load(101);
check((float) $overpaid['financials']['balance'] === 0.0 && $overpaid['financials']['overpayment'] === 100.0, 'Overpayment must remain separate from balance');
$meta[101]['data_prices']['total_price'] = 0;
check(tripanza_native_editor_load(101)['financials']['balance'] === 2000.0, 'A complete status with saved zero received must retain the full balance');
$meta = $balance_snapshot;
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
check(!is_wp_error(post_request('status', array('status' => 'complete'))) && tripanza_native_editor_load(101)['financials']['balance'] === tripanza_native_editor_load(101)['financials']['final_total'], 'Status-only change must not erase unpaid balance');
check(!is_wp_error(post_request('resend')) && $mail === 2, 'Mail sent only on explicit status/resend actions');
check(!is_wp_error(post_request('whatsapp', array('phone' => '+91 98765 43210'))) && $whatsapp === 1, 'Explicit WhatsApp action only');
$meta[101]['wc_order_id'] = 999; check(is_wp_error(post_request('status', array('status' => 'partial'))), 'WooCommerce-linked bookings are read-only');
check(tripanza_native_editor_normalize_date('31/02/2026') === '' && tripanza_native_editor_normalize_date('12/10/2026') === '2026-10-12', 'Strict timezone date normalization');
echo "PASS PHP execution: real history/editor balance parity, complete advance versus full payment, preserved closed statuses, overpayment, pricing, immutable snapshot, metadata/table synchronization, retries, stale writes, rollback, storage guards, zero payments, dates, wallet-once, status/email/WhatsApp, WooCommerce protection\n";
