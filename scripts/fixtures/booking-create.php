<?php
// Reuse the isolated WordPress stubs and regression tests, never a live DB.
require '/fixture.php';
require '/booking-create.php';
class STTour {}
$creation_storage = true; $permission_denied = false; $mail_failure = false; $posts = array(27807 => array('post_type' => 'st_tours', 'post_status' => 'publish', 'post_title' => 'Custom template')); $next_post_id = 1000;
$meta[27807] = array('template_list' => serialize(array('one', 'two')), 'address' => 'Original template location');
$std_calls = array(); $std_sold_out = false; $created_hooks = 0;
add_action('st_booking_created', function () { global $created_hooks; $created_hooks++; });
function tripanza_create_tour_booking($tour, $first, $last, $email, $phone, $date, $adults, $children, $infants) {
    global $std_calls, $std_sold_out;
    $std_calls[] = func_get_args(); if ($std_sold_out) return false;
    $id = wp_insert_post(array('post_type' => 'st_order', 'post_status' => 'publish', 'post_author' => 7, 'post_title' => 'Standard fixture'));
    foreach (array('item_id' => $tour, 'st_booking_id' => $tour, 'st_email' => $email, 'adult_number' => $adults, 'child_number' => $children, 'infant_number' => $infants, 'check_in' => $date, 'check_out' => $date, 'data_prices' => array('total_price_with_tax' => 2000, 'total_price' => 500), 'status' => 'on-hold', 'raw_data' => '{"guest_name":["Generated"]}', 'item_data' => array('guest_name' => array('Generated')), 'st_cart_info' => array($tour => array('data' => array('guest_name' => array('Generated')))), 'guest_name' => array('Generated')) as $key => $value) update_post_meta($id, $key, $value);
    do_action('st_booking_created', $id, $tour); STCart::send_mail_after_booking($id); return $id;
}
function create_input($mode = 'custom', $extra = array()) {
    return array('mode' => $mode, 'nonce' => 'fixture-nonce', 'request_id' => bin2hex(random_bytes(16)), 'fields' => array_replace(array('selected_tour_id' => 10, 'custom_package_name' => "Guest's Spiti Trip", 'first_name' => 'Fixture', 'last_name' => 'Guest', 'email' => 'guest@example.test', 'phone' => '+91 98765 43210', 'check_in' => '2026-11-10', 'check_out' => '2026-11-13', 'duration' => '3 Days / 2 Nights', 'boarding' => 'Delhi Airport', 'dropoff' => 'Manali', 'adults' => 2, 'children' => 1, 'infants' => 0, 'quad_price' => 1000, 'triple_price' => 1200, 'twin_price' => 1500, 'advance_payment' => '0', 'balance_due_days' => 7, 'guests' => array(array('name' => 'Traveller One | 25', 'title' => 'mr'), array('name' => 'Traveller Two | 24', 'title' => 'miss'))), $extra));
}
function create_request($input) { return tripanza_native_create_post(new WP_REST_Request($input)); }
function check_create($condition, $message) { if (!$condition) throw new RuntimeException('Creation: ' . $message); }
$template_before = $meta[27807]; $mail_before = $mail;
$input = create_input(); $response = create_request($input); check_create(!is_wp_error($response), 'Custom succeeds'); $id = $response['order_id']; $shadow = $meta[$id]['item_id'];
check_create(get_post_type($id) === 'st_order' && get_post($shadow)->post_status === 'private', 'Private shadow, normal Traveler order');
check_create(get_the_title($shadow) === "Customized Trip - Guest's Spiti Trip" && $meta[$shadow]['template_list'] === array('one', 'two') && $meta[27807] === $template_before, 'Clone decoded metadata, no template mutation');
check_create($meta[$id]['data_prices']['total_price_with_tax'] === '3200' && $meta[$id]['data_prices']['total_price'] === '0', 'Server-calculated custom total, explicit zero advance preserved');
check_create($meta[$id]['balance_due_days'] === 7 && $meta[$id]['check_in'] === '2026-11-10' && $meta[$id]['item_data']['check_out'] === '2026-11-13' && $items[$id]['st_booking_id'] === $shadow, 'Schedule, due-days and registered item');
$editor = tripanza_native_editor_load($id); check_create($editor['financials']['balance'] === 3200.0 && $editor['booking']['balance'] === 3200.0 && $editor['fields']['duration'] === '3 Days / 2 Nights', 'Immediate editor and history agree');
check_create($mail === $mail_before + 1 && $created_hooks === 1, 'Custom lifecycle/email once after commit');
$posts_count = count($posts); $repeat = create_request($input); check_create($repeat['order_id'] === $id && count($posts) === $posts_count && $mail === $mail_before + 1, 'Lost-response retry no order/mail/hook duplication');
$conflict = $input; $conflict['fields']['quad_price'] = 2000; check_create(is_wp_error(create_request($conflict)), 'Request key collision rejects changed payload');
$receipt_key = 'tripanza_native_create_' . hash('sha256', '1|' . $input['request_id']); unset($options[$receipt_key]['result']);
$recover = create_request($input); check_create($recover['order_id'] === $id && count($posts) === $posts_count && $mail === $mail_before + 1, 'Interrupted confirmation recovers marker without repeating hooks');
$blank = create_request(create_input('custom', array('advance_payment' => ''))); check_create($meta[$blank['order_id']]['data_prices']['total_price'] === '3200', 'Blank advance retains reference default');
foreach (array(array('advance_payment' => '-1'), array('advance_payment' => '9999'), array('check_in' => '2026-02-31'), array('check_out' => '2020-01-01'), array('adults' => -1), array('adults' => 1.5), array('email' => 'bad'), array('quad_price' => '1.234')) as $invalid) check_create(is_wp_error(create_request(create_input('custom', $invalid))), 'Invalid fields must reject');
$before_rollback = array($meta, $posts, $items, $mail, $created_hooks); $wpdb->fail = true; $failed = create_request(create_input()); $wpdb->fail = false;
check_create(is_wp_error($failed) && array($meta, $posts, $items, $mail, $created_hooks) === $before_rollback, 'Injected registration failure rolls back order/shadow/meta, no notifications');
$wpdb->engine = 'MyISAM'; check_create(is_wp_error(create_request(create_input())), 'Fail closed on non-transactional custom storage'); $wpdb->engine = 'InnoDB';
$standard = create_input('standard'); $mail_before = $mail; $response = create_request($standard); check_create(!is_wp_error($response), 'Standard succeeds'); $id = $response['order_id'];
check_create(count($std_calls) === 1 && $std_calls[0] === array(10, 'Fixture', 'Guest', 'guest@example.test', '+91 98765 43210', '2026-11-10', 2, 1, 0), 'Standard delegates original function unchanged');
check_create($meta[$id]['guest_name'][0] === 'Traveller One | 25' && $meta[$id]['item_data']['guest_title'][1] === 'miss' && $meta[$id]['st_cart_info'][10]['data']['adult'][1]['title'] === 'miss', 'Guest fields synchronized after original creation');
check_create($meta[$id]['data_prices']['total_price'] === 500 && $mail === $mail_before + 1, 'Standard prices/email stay owned by original function');
create_request($standard); check_create(count($std_calls) === 1 && $mail === $mail_before + 1, 'Standard duplicate no function/mail repeat');
$std_sold_out = true; check_create(is_wp_error(create_request(create_input('standard'))), 'Original sold-out result preserved'); $std_sold_out = false;
$mail_failure = true; $mail_error_request = create_input('standard'); $response = create_request($mail_error_request); $mail_failure = false;
check_create(!is_wp_error($response) && $response['warning'] !== '', 'Order captured when existing function throws after insertion');
$calls_before = count($std_calls); create_request($mail_error_request); check_create(count($std_calls) === $calls_before, 'Email failure cannot recreate standard order');
$permission_denied = true; check_create(is_wp_error(create_request(create_input())), 'Only admins create'); $permission_denied = false;
$bad_nonce = create_input(); $bad_nonce['nonce'] = 'wrong'; check_create(is_wp_error(create_request($bad_nonce)), 'Nonce required');
echo "PASS native creation PHP: protected validation, custom prices/zero/blank advance, private clone, timezone dates, real editor/history parity, atomic rollback, guest copies, existing standard function delegation, durable retry/recovery and hooks/mail once\n";
