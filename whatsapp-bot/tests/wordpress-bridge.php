<?php
// Runs with a PHP CLI (or PHP.wasm). No live WordPress database, mail or payments.
define('ABSPATH', '/');
date_default_timezone_set('UTC');
$options = []; $meta = []; $sent = 0; $orders = 0; $mail_ok = true; $booking_throw = false;
class WP_Error { public $code; public function __construct($code, $message = '', $data = []) { $this->code = $code; } }
function is_wp_error($value) { return $value instanceof WP_Error; }
function add_action($name, $callback) {}
function get_option($key, $fallback = false) { global $options; return $options[$key] ?? $fallback; }
function add_option($key, $value, $unused = '', $autoload = false) { global $options; if (array_key_exists($key, $options)) { return false; } $options[$key] = $value; return true; }
function update_option($key, $value, $autoload = false) { global $options; $options[$key] = $value; return true; }
function wp_json_encode($value) { return json_encode($value); }
function home_url($path = '') { return 'https://tripanza.test' . $path; }
function wp_parse_url($value) { return parse_url($value); }
function url_to_postid($value) { return $value === 'https://tripanza.test/tour/manali-trip/' ? 22 : 0; }
function get_post_status($id) { return 'publish'; }
function get_post_type($id) { return 'st_tours'; }
function get_the_title($id) { return 'Manali Trip'; }
function wp_timezone() { return new DateTimeZone('Asia/Kolkata'); }
function is_email($value) { return is_string($value) && filter_var($value, FILTER_VALIDATE_EMAIL); }
function sanitize_text_field($value) { return trim(strip_tags($value)); }
function get_post_meta($id, $key, $single = true) { global $meta; return $meta[$id][$key] ?? ''; }
function update_post_meta($id, $key, $value) { global $meta; $meta[$id][$key] = $value; }
function build_tour_itinerary_html($id) { return '<h1>Manali Trip</h1>'; }
function wp_mail($email, $subject, $html, $headers) { global $sent, $mail_ok; $sent++; return $mail_ok; }
function tripanza_create_tour_booking($id, $first, $last, $email, $phone, $date, $quad, $triple, $twin) {
    global $orders, $booking_throw; $orders++;
    if ($booking_throw) { throw new RuntimeException('Simulated crash'); }
    $id = 1000 + $orders; update_post_meta($id, 'total_price', 6300); update_post_meta($id, 'data_prices', ['total_price_with_tax' => 31500]); return $id;
}
class STPrice { static function getTax() { return 5; } }
class Request {
    public $body; public $token;
    function __construct($body = [], $token = '') { $this->body = $body; $this->token = $token; }
    function get_json_params() { return $this->body; }
    function get_header($name) { return $this->token; }
}
function check($condition, $message) { if (!$condition) { throw new RuntimeException($message); } }
require __DIR__ . '/../business/wordpress/tripanza-workspace-bridge.php';
$token = str_repeat('a', 64); $options['twb_token_hash'] = hash('sha256', $token);
check(twb_permission(new Request([], $token)) === true, 'Valid authentication rejected');
check(is_wp_error(twb_permission(new Request([], ''))), 'Missing authentication accepted');
check(is_wp_error(twb_permission(new Request([], str_repeat('b', 64)))), 'Incorrect authentication accepted');
check(twb_tour('https://outside.test/tour/manali-trip/') === 0, 'External tour accepted');
check(twb_tour('https://tripanza.test/blog/manali-trip/') === 0, 'Non-tour accepted');
$meta[22] = ['_seats_availability' => ['16/10/2099' => '1'], 'adult_price' => '7500', 'child_price' => '8000', 'infant_price' => '9000', 'deposit_payment_amount' => '20'];
$data = ['kind' => 'booking', 'request_id' => str_repeat('c', 64), 'tour_url' => 'https://tripanza.test/tour/manali-trip/', 'name' => 'Riya Verma', 'email' => 'riya@example.test', 'phone' => '919800000001', 'date' => '16/10/2099', 'quad' => 4, 'triple' => 0, 'twin' => 0];
$quote = twb_quote(new Request($data));
check(!is_wp_error($quote) && $quote['total'] === 31500.0 && $quote['advance'] === 6300.0, 'Quote formula or date timezone mismatch');
check($orders === 0 && $sent === 0, 'Quote performed a side effect');
$invalid = $data; $invalid['date'] = '31/02/2099'; check(is_wp_error(twb_quote(new Request($invalid))), 'Invalid calendar date accepted');
$invalid = $data; $invalid['quad'] = -1; check(is_wp_error(twb_quote(new Request($invalid))), 'Negative travellers accepted');
$invalid = $data; $invalid['quad'] = '4'; check(is_wp_error(twb_quote(new Request($invalid))), 'String travellers accepted');
$meta[22]['_seats_availability']['16/10/2099'] = '0'; check(is_wp_error(twb_quote(new Request($data))), 'Sold-out departure accepted');
$meta[22]['_seats_availability']['16/10/2099'] = '1';
$data['expected_total'] = 30000; $data['expected_advance'] = 6000;
check(is_wp_error(twb_action(new Request($data))) && $orders === 0, 'Changed price created an order');
$data['expected_total'] = 31500; $data['expected_advance'] = 6300;
$receipt = twb_action(new Request($data)); check($receipt['success'] && $receipt['status'] === 'pending_payment' && $orders === 1, 'Booking receipt missing');
check(twb_action(new Request($data)) === $receipt && $orders === 1, 'Retry created duplicate order');
$different = $data; $different['quad'] = 3; check(is_wp_error(twb_action(new Request($different))) && $orders === 1, 'Conflicting request ID reused');
$email = ['kind' => 'email', 'request_id' => str_repeat('d', 64), 'tour_url' => $data['tour_url'], 'email' => $data['email'], 'phone' => $data['phone']];
$receipt = twb_action(new Request($email)); check($receipt['status'] === 'accepted' && $sent === 1, 'Mail acceptance missing');
check(twb_action(new Request($email)) === $receipt && $sent === 1, 'Retry resent email');
$mail_ok = false; $email['request_id'] = str_repeat('e', 64); $failed = twb_action(new Request($email)); check(!$failed['success'] && $failed['status'] === 'failed', 'Mail failure reported as sent');
$booking_throw = true; $data['request_id'] = str_repeat('f', 64); check(is_wp_error(twb_action(new Request($data))), 'Crash reported as success');
$count = $orders; check(is_wp_error(twb_action(new Request($data))) && $orders === $count, 'Uncertain booking was retried');
echo "PHP bridge checks passed: auth, scope, future departures, pricing, price changes, idempotency, failures and pending payment.\n";
