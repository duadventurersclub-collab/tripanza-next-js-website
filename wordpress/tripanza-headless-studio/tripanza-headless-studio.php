<?php
/**
 * Plugin Name: Tripanza Original Host Studio Bridge
 * Description: Runs the complete original poster and trip studios through the authenticated Next.js app.
 * Version: 1.0.0
 * Requires PHP: 7.4
 */

defined('ABSPATH') || exit;

// These documents contain private host data and user-specific form nonces.
if (isset($_GET['tripanza_host_studio']) && !defined('DONOTCACHEPAGE')) {
    define('DONOTCACHEPAGE', true);
}

function tripanza_original_studio_dispatch() {
    if (!isset($_GET['tripanza_host_studio'])) return;
    nocache_headers();
    header('Cache-Control: private, no-store, max-age=0');
    header('X-Tripanza-Studio: 1');
    header('X-Content-Type-Options: nosniff');
    do_action('litespeed_control_set_nocache', 'Authenticated Tripanza host studio');

    if (!class_exists('Tripanza_Headless_Host_API')) {
        wp_send_json_error('Activate the Tripanza Headless Core API first.', 503);
    }
    $permission = Tripanza_Headless_Host_API::require_host();
    if (is_wp_error($permission)) {
        wp_send_json_error($permission->get_error_message(), (int) ($permission->get_error_data()['status'] ?? 403));
    }
    $screen = sanitize_key(wp_unslash($_GET['tripanza_host_studio']));
    if (!in_array($screen, array('posters', 'trips', 'tools'), true)) wp_send_json_error('Studio not found.', 404);
    if (!in_array($_SERVER['REQUEST_METHOD'], array('GET', 'POST'), true)) wp_send_json_error('Method not allowed.', 405);

    if ($screen === 'tools') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') wp_send_json_error('Method not allowed.', 405);
        $nonce = sanitize_text_field(wp_unslash($_POST['studio_nonce'] ?? ''));
        if (!wp_verify_nonce($nonce, 'tripanza_original_studio_tools')) wp_send_json_error('Refresh the studio and try again.', 403);
        $post_id = absint($_POST['post_id'] ?? 0);
        $post = $post_id ? get_post($post_id) : null;
        if (!$post || $post->post_type !== 'st_tours' || (!current_user_can('manage_options') && (int) $post->post_author !== get_current_user_id())) {
            wp_send_json_error('You cannot change this trip.', 403);
        }
        if (!current_user_can('manage_options') && get_post_meta($post_id, 'host_parent_trip_id', true)) {
            wp_send_json_error('Only an administrator can change a master-trip copy.', 403);
        }
        $action = sanitize_key(wp_unslash($_POST['action'] ?? ''));
        if (!in_array($action, array('tripanza_reset_pdf_design', 'tripanza_clear_tour_cache'), true)) wp_send_json_error('Action not allowed.', 400);
        if (!function_exists('tripanza_clear_post_pdf_cache')) wp_send_json_error('The Tripanza PDF module is unavailable.', 503);
        $count = tripanza_clear_post_pdf_cache($post_id);
        wp_send_json_success($action === 'tripanza_reset_pdf_design' ? 'Reset done' : sprintf('Cleared %d cached files for this tour.', $count));
    }

    // Reject an invalid edit ID rather than silently creating a new trip.
    if ($screen === 'trips' && !empty($_GET['tour_id'])) {
        $tour = get_post(absint($_GET['tour_id']));
        if (!$tour || $tour->post_type !== 'st_tours') wp_send_json_error('Trip not found.', 404);
        if (!current_user_can('manage_options') && (int) $tour->post_author !== get_current_user_id()) wp_send_json_error('You cannot edit this trip.', 403);
    }

    // Keep WordPress loop/reset behavior identical to the original page template.
    global $wp_query, $post;
    $page = get_page_by_path($screen === 'posters' ? 'poster-download' : 'add-your-own-trip');
    if ($page) {
        $wp_query = new WP_Query(array('page_id' => $page->ID, 'post_type' => 'page'));
        $wp_query->the_post();
    }
    // Live-layout links open the Next.js tour, preserving the app's session.
    add_filter('post_type_link', function ($link, $tour) {
        return $tour->post_type === 'st_tours' ? '/tours/' . rawurlencode($tour->post_name) : $link;
    }, 100, 2);

    // Buffer the original template so its redirects and JSON AI responses can
    // run before any HTML headers/body are sent. Every original control remains.
    ob_start();
    include __DIR__ . '/templates/' . ($screen === 'posters' ? 'posters.php' : 'trips.php');
    $html = ob_get_clean();
    header('Content-Type: text/html; charset=UTF-8');
    echo $html;
    exit;
}

add_action('template_redirect', 'tripanza_original_studio_dispatch', -100);
