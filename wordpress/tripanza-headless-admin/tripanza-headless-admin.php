<?php
/**
 * Plugin Name: Tripanza Native Admin API
 * Description: Protected JSON data and actions for the native Next.js admin dashboard. No embedded pages.
 * Version: 2.3.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */
defined('ABSPATH') || exit;
require_once __DIR__ . '/includes/analytics.php';
require_once __DIR__ . '/includes/presets.php';
require_once __DIR__ . '/includes/holidays.php';
require_once __DIR__ . '/includes/itinerary.php';
require_once __DIR__ . '/includes/bookings.php';
require_once __DIR__ . '/includes/booking-editor.php';
require_once __DIR__ . '/includes/booking-create.php';

function tripanza_native_admin_permission() {
    nocache_headers();
    do_action('litespeed_control_set_nocache', 'Private Tripanza admin API');
    if (!is_user_logged_in()) return new WP_Error('tripanza_admin_login', 'Please sign in.', array('status' => 401));
    if (!current_user_can('manage_options')) return new WP_Error('tripanza_admin_only', 'Administrator access required.', array('status' => 403));
    return true;
}
function tripanza_native_admin_response($data, $status = 200) {
    if (is_wp_error($data)) return $data;
    $response = new WP_REST_Response($data, $status);
    $response->header('Cache-Control', 'private, no-store, max-age=0');
    return $response;
}
function tripanza_native_admin_error($message, $status = 400) {
    return new WP_Error('tripanza_admin_request', $message, array('status' => $status));
}
function tripanza_native_admin_list($option) {
    $items = get_option($option, array());
    return is_array($items) ? array_values(array_filter($items, 'is_array')) : array();
}
function tripanza_native_admin_rows($option) {
    return array_map(function ($row) {
        $row['id'] = (string) ($row['id'] ?? '');
        $row['author_id'] = absint($row['author_id'] ?? 0);
        return $row;
    }, tripanza_native_admin_list($option));
}
function tripanza_native_admin_valid_date($value) {
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D', $value, $parts)) return false;
    return checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1]);
}
function tripanza_native_admin_get() {
    $user = wp_get_current_user();
    $admin_ids = get_users(array('role' => 'administrator', 'fields' => 'ID'));
    $tours = $admin_ids ? get_posts(array('post_type' => 'st_tours', 'post_status' => 'publish', 'posts_per_page' => -1, 'author__in' => $admin_ids, 'orderby' => 'title', 'order' => 'ASC')) : array();
    $page = get_page_by_path('admin');
    $holidays = get_option('tripanza_holiday_opportunities', tripanza_native_default_holidays());
    return tripanza_native_admin_response(array(
        'api_version' => '2.0.0', 'user' => array('id' => (int) $user->ID, 'name' => $user->display_name),
        'today' => current_time('Y-m-d'), 'nonce' => wp_create_nonce('tripanza_native_admin'),
        'tasks' => tripanza_native_admin_rows('tripanza_admin_todos'),
        'plans' => tripanza_native_admin_rows('tripanza_future_trips'),
        'holidays' => is_array($holidays) ? array_values(array_filter($holidays, 'is_array')) : tripanza_native_default_holidays(),
        'bookings' => tripanza_native_admin_bookings(), 'analytics_limit' => 1000,
        'tours' => array_map(function ($tour) {
            return array('id' => (int) $tour->ID, 'title' => html_entity_decode(get_the_title($tour), ENT_QUOTES, 'UTF-8'), 'pdf_url' => esc_url_raw(add_query_arg('generate_pdf', '1', get_permalink($tour->ID))));
        }, $tours),
        'intro' => $page ? wp_kses_post(apply_filters('the_content', $page->post_content)) : '',
        'capabilities' => array('analytics' => class_exists('STUser_f') && is_callable(array('STUser_f', 'get_history_bookings')) && is_callable(array('STUser_f', '_get_order_statuses')) && is_callable(array('STPrice', 'getTotalPriceWithTaxInOrder')), 'email' => function_exists('build_tour_itinerary_html'), 'ai' => (bool) get_option('whatsapp_ai_openai_api_key')),
    ));
}
// Keep the original numeric IDs/options compatible with the existing WP tools.
function tripanza_native_admin_id($rows) {
    $id = (int) floor(microtime(true) * 1000);
    $ids = array_map(function ($row) { return (string) ($row['id'] ?? ''); }, $rows);
    while (in_array((string) $id, $ids, true)) $id++;
    return $id;
}
function tripanza_native_admin_save($option, $rows) {
    $rows = array_values($rows);
    if (update_option($option, $rows) === false && get_option($option) !== $rows) return tripanza_native_admin_error('Changes could not be saved. Please try again.', 500);
    return true;
}
function tripanza_native_admin_post(WP_REST_Request $request) {
    $data = $request->get_json_params();
    if (!is_array($data)) return tripanza_native_admin_error('JSON is required.');
    foreach ($data as $value) if (!is_scalar($value) || strlen((string) $value) > 4000) return tripanza_native_admin_error('Invalid input.');
    $nonce = (string) ($data['nonce'] ?? '');
    if (!wp_verify_nonce($nonce, 'tripanza_native_admin')) return tripanza_native_admin_error('Your dashboard session expired. Refresh and try again.', 403);
    $action = (string) ($data['action'] ?? '');
    $allowed = array('add_todo', 'toggle_todo', 'delete_todo', 'add_future_trip', 'delete_future_trip', 'generate_preset_holidays', 'clear_all_holidays', 'send_tour_itinerary_email');
    if (!in_array($action, $allowed, true)) return tripanza_native_admin_error('Action not allowed.');
    if ($action === 'send_tour_itinerary_email') {
        if (!function_exists('build_tour_itinerary_html')) return tripanza_native_admin_error('Activate the Tripanza itinerary email module.', 503);
        $tour_id = absint($data['post_id'] ?? 0);
        $email = sanitize_email((string) ($data['customer_email'] ?? ''));
        $departure = (string) ($data['departure_date'] ?? '');
        if (!is_email($email) || strlen($email) > 254 || get_post_type($tour_id) !== 'st_tours' || get_post_status($tour_id) !== 'publish' || ($departure !== '' && !tripanza_native_admin_valid_date($departure))) return tripanza_native_admin_error('Choose a published tour, valid customer email and valid departure date.');
        $previous_post = $_POST;
        $_POST = array('post_id' => $tour_id, 'customer_email' => $email, 'customer_phone' => wp_slash(sanitize_text_field((string) ($data['customer_phone'] ?? ''))), 'departure_date' => $departure, 'security' => wp_create_nonce('tripanza_send_tour_itinerary'));
        try { return tripanza_native_admin_response(tripanza_native_send_itinerary()); }
        finally { $_POST = $previous_post; }
    }
    $generated = null;
    if ($action === 'generate_preset_holidays') {
        $preset = (string) ($data['preset_type'] ?? '');
        if (!in_array($preset, array('long_weekends', 'festive', 'du', 'ipu', 'amity', 'mumbai', 'gujarat', 'bangalore', 'corporate'), true)) return tripanza_native_admin_error('Choose a valid preset.');
        // Network calls happen outside the short shared-option write lock.
        $generated = tripanza_native_generate_holidays($preset);
        if (is_wp_error($generated)) return $generated;
    }
    $lock = array('owner' => wp_generate_uuid4(), 'until' => time() + 15);
    $lock_key = 'tripanza_native_admin_write_lock';
    $current_lock = get_option($lock_key);
    if (is_array($current_lock) && (int) $current_lock['until'] < time()) delete_option($lock_key);
    if (!add_option($lock_key, $lock, '', false)) return tripanza_native_admin_error('Another team update is saving. Please try again.', 409);
    try { return tripanza_native_admin_response(tripanza_native_admin_mutate($action, $data, $generated)); }
    finally { if (get_option($lock_key) === $lock) delete_option($lock_key); }
}
function tripanza_native_admin_mutate($action, $data, $generated) {
    $user = wp_get_current_user();
    if (in_array($action, array('add_todo', 'toggle_todo', 'delete_todo'), true)) {
        $option = 'tripanza_admin_todos'; $rows = tripanza_native_admin_list($option);
        if ($action === 'add_todo') {
            $text = sanitize_text_field(trim((string) ($data['todo_text'] ?? '')));
            $date = (string) ($data['todo_date'] ?? '');
            if ($text === '' || strlen($text) > 2000 || !tripanza_native_admin_valid_date($date)) return tripanza_native_admin_error('Enter a task and a valid target date.');
            $request_key = (string) ($data['request_key'] ?? '');
            foreach ($rows as $row) if ($request_key !== '' && ($row['request_key'] ?? '') === $request_key && (int) ($row['author_id'] ?? 0) === (int) $user->ID) return array('tasks' => tripanza_native_admin_rows($option));
            array_unshift($rows, array('id' => tripanza_native_admin_id($rows), 'text' => $text, 'target_date' => $date, 'author' => $user->display_name, 'author_id' => (int) $user->ID, 'date' => current_time('mysql'), 'status' => 'pending', 'request_key' => $request_key));
            $rows = array_slice($rows, 0, 50);
        } else {
            $found = false;
            foreach ($rows as $index => $row) if ((string) ($row['id'] ?? '') === (string) ($data['todo_id'] ?? '')) {
                $found = true;
                if ($action === 'delete_todo') {
                    if ((int) ($row['author_id'] ?? 0) !== (int) $user->ID) return tripanza_native_admin_error('Only the task author may delete it.', 403);
                    unset($rows[$index]);
                } else {
                    $status = (string) ($data['status'] ?? '');
                    if (!in_array($status, array('pending', 'completed'), true)) return tripanza_native_admin_error('Invalid task status.');
                    $rows[$index]['status'] = $status; // Explicit status makes retries safe, not a blind toggle.
                }
                break;
            }
            if (!$found) return tripanza_native_admin_error('Task no longer exists. Refresh the dashboard.', 404);
        }
        $saved = tripanza_native_admin_save($option, $rows);
        return is_wp_error($saved) ? $saved : array('tasks' => tripanza_native_admin_rows($option));
    }
    if (in_array($action, array('add_future_trip', 'delete_future_trip'), true)) {
        $option = 'tripanza_future_trips'; $rows = tripanza_native_admin_list($option);
        if ($action === 'add_future_trip') {
            $name = sanitize_text_field(trim((string) ($data['trip_name'] ?? '')));
            $dates = array_values(array_unique(array_map('trim', explode(',', (string) ($data['trip_dates'] ?? '')))));
            if ($name === '' || strlen($name) > 2000 || count($dates) > 50 || !$dates) return tripanza_native_admin_error('Enter a destination and up to 50 departure dates.');
            foreach ($dates as $date) if (!tripanza_native_admin_valid_date($date)) return tripanza_native_admin_error('Choose valid departure dates.');
            $request_key = (string) ($data['request_key'] ?? '');
            foreach ($rows as $row) if ($request_key !== '' && ($row['request_key'] ?? '') === $request_key && (int) ($row['author_id'] ?? 0) === (int) $user->ID) return array('plans' => tripanza_native_admin_rows($option));
            foreach ($dates as $value) {
                $date = new DateTimeImmutable($value, wp_timezone());
                $rows[] = array('id' => tripanza_native_admin_id($rows), 'name' => $name, 'month' => strtolower($date->format('F')), 'dates' => $date->format('jS F Y'), 'author' => $user->display_name, 'author_id' => (int) $user->ID, 'request_key' => $request_key);
            }
        } else {
            $found = false;
            foreach ($rows as $index => $row) if ((string) ($row['id'] ?? '') === (string) ($data['trip_id'] ?? '')) { unset($rows[$index]); $found = true; break; }
            if (!$found) return tripanza_native_admin_error('Trip plan no longer exists. Refresh the dashboard.', 404);
        }
        $saved = tripanza_native_admin_save($option, $rows);
        return is_wp_error($saved) ? $saved : array('plans' => tripanza_native_admin_rows($option));
    }
    $holidays = array();
    if ($action === 'generate_preset_holidays') {
        $today = new DateTimeImmutable('today', wp_timezone());
        $existing = get_option('tripanza_holiday_opportunities', tripanza_native_default_holidays());
        foreach ((array) $existing as $holiday) {
            if (!is_array($holiday)) continue;
            $parts = explode('-', (string) ($holiday['date'] ?? ''));
            $end = trim(end($parts));
            $timestamp = strtotime($end . ' ' . $today->format('Y'));
            if ($timestamp && $timestamp < $today->getTimestamp() && !((int) $today->format('n') >= 11 && (int) wp_date('n', $timestamp) <= 2)) continue;
            $holidays[] = $holiday;
        }
        $seen = array(); $unique = array();
        foreach (array_merge($holidays, $generated) as $holiday) {
            $key = strtolower(trim($holiday['name'])) . '|' . strtolower(trim($holiday['date']));
            if (!isset($seen[$key])) { $seen[$key] = true; $unique[] = $holiday; }
        }
        $holidays = $unique;
    }
    $saved = tripanza_native_admin_save('tripanza_holiday_opportunities', $holidays);
    return is_wp_error($saved) ? $saved : array('holidays' => $holidays);
}
add_action('rest_api_init', function () {
    register_rest_route('tripanza-headless/v1', '/admin/identity', array('methods' => 'GET', 'permission_callback' => 'tripanza_native_admin_permission', 'callback' => function () {
        $user = wp_get_current_user();
        return tripanza_native_admin_response(array('id' => (int) $user->ID, 'name' => $user->display_name, 'api_version' => '2.0.0'));
    }));
    register_rest_route('tripanza-headless/v1', '/admin/workspace', array(
        array('methods' => 'GET', 'permission_callback' => 'tripanza_native_admin_permission', 'callback' => 'tripanza_native_admin_get'),
        array('methods' => 'POST', 'permission_callback' => 'tripanza_native_admin_permission', 'callback' => 'tripanza_native_admin_post'),
    ));
});
