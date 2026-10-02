<?php
/**
 * Plugin Name: Tripanza Site Controls
 * Description: Administrator-only cache controls and a server-side Host feature switch for Tripanza Next.js.
 * Version: 1.0.0
 * Requires PHP: 7.4
 */
defined('ABSPATH') || exit;

final class Tripanza_Site_Controls {
    const OPTION = 'tripanza_site_controls_v1';
    const NS = 'tripanza-headless/v1';

    public static function defaults() {
        return array('host_enabled' => true, 'public_cache_enabled' => true,
            'tour_cache_seconds' => 300, 'availability_cache_seconds' => 60, 'reel_cache_seconds' => 300, 'host_cache_seconds' => 60,
            'site_cache_seconds' => 3600, 'leaderboard_cache_seconds' => 600,
            'booking_cache_seconds' => 15, 'browser_cache_seconds' => 3300,
            'cache_revision' => 'initial', 'revision' => 'initial', 'updated_at' => '', 'updated_by' => '');
    }

    public static function settings() {
        return array_merge(self::defaults(), (array) get_option(self::OPTION, array()));
    }

    public static function init() {
        add_action('rest_api_init', array(__CLASS__, 'routes'));
        add_filter('rest_pre_dispatch', array(__CLASS__, 'gate_rest'), 1000, 3);
        add_filter('rest_post_dispatch', array(__CLASS__, 'private_headers'), 1000, 3);
        add_action('template_redirect', array(__CLASS__, 'gate_pages'), -200);
        add_action('admin_init', array(__CLASS__, 'gate_ajax'), -200);
        add_action('admin_menu', array(__CLASS__, 'admin_menu'));
        add_action('admin_post_tripanza_site_controls', array(__CLASS__, 'admin_save'));
        $key = 'tripanza_headless_host_league_' . wp_date('Y-m');
        add_filter('pre_transient_' . $key, array(__CLASS__, 'leaderboard_read'));
        add_filter('expiration_of_transient_' . $key, array(__CLASS__, 'leaderboard_ttl'));
    }

    public static function require_admin() {
        if (!is_user_logged_in()) return new WP_Error('tripanza_auth', 'Please sign in.', array('status' => 401));
        return current_user_can('manage_options') ? true : new WP_Error('tripanza_forbidden', 'Administrator access required.', array('status' => 403));
    }

    public static function routes() {
        register_rest_route(self::NS, '/settings/public', array('methods' => 'GET', 'callback' => array(__CLASS__, 'public_settings'), 'permission_callback' => '__return_true'));
        register_rest_route(self::NS, '/admin/settings', array(
            array('methods' => 'GET', 'callback' => array(__CLASS__, 'admin_settings'), 'permission_callback' => array(__CLASS__, 'require_admin')),
            array('methods' => 'POST', 'callback' => array(__CLASS__, 'save'), 'permission_callback' => array(__CLASS__, 'require_admin')),
        ));
        register_rest_route(self::NS, '/admin/cache', array('methods' => 'POST', 'callback' => array(__CLASS__, 'purge'), 'permission_callback' => array(__CLASS__, 'require_admin')));
    }

    private static function response($data) {
        nocache_headers();
        return new WP_REST_Response($data, 200, array('Cache-Control' => 'private, no-store, max-age=0'));
    }

    public static function public_settings() {
        $settings = self::settings();
        unset($settings['updated_by']);
        return self::response($settings);
    }

    public static function admin_settings() {
        return self::response(array('settings' => self::settings(), 'capabilities' => array(
            'pdf' => function_exists('tripanza_clear_post_pdf_cache'),
            'page_cache' => defined('LSCWP_V') || function_exists('rocket_clean_domain') || (bool) has_action('w3tc_flush_posts'),
        )));
    }

    public static function save($request) {
        $permission = self::require_admin();
        if (is_wp_error($permission)) return $permission;
        $input = $request->get_json_params();
        if (!is_array($input)) return new WP_Error('tripanza_input', 'Invalid settings.', array('status' => 400));
        $settings = self::settings();
        $host_was_enabled = $settings['host_enabled'];
        if (($input['revision'] ?? '') !== $settings['revision']) return new WP_Error('tripanza_conflict', 'Settings changed in another window. Reload before saving.', array('status' => 409));
        foreach (array('host_enabled', 'public_cache_enabled') as $key) {
            if (!isset($input[$key]) || !is_bool($input[$key])) return new WP_Error('tripanza_input', 'Invalid toggle: ' . $key, array('status' => 400));
            $settings[$key] = $input[$key];
        }
        $limits = array('tour_cache_seconds' => 86400, 'availability_cache_seconds' => 300, 'reel_cache_seconds' => 86400, 'host_cache_seconds' => 3600,
            'site_cache_seconds' => 86400, 'leaderboard_cache_seconds' => 3600, 'booking_cache_seconds' => 60, 'browser_cache_seconds' => 3300);
        foreach ($limits as $key => $max) {
            if (!isset($input[$key]) || !is_int($input[$key]) || $input[$key] < 0 || $input[$key] > $max) return new WP_Error('tripanza_input', sprintf('%s must be between 0 and %d seconds.', $key, $max), array('status' => 400));
            $settings[$key] = $input[$key];
        }
        $settings['revision'] = wp_generate_uuid4();
        $settings['cache_revision'] = $settings['revision'];
        $settings['updated_at'] = gmdate('c');
        $settings['updated_by'] = wp_get_current_user()->display_name;
        update_option(self::OPTION, $settings, false);
        delete_transient('tripanza_headless_host_league_' . wp_date('Y-m'));
        if ($host_was_enabled !== $settings['host_enabled']) self::purge_page_cache();
        self::audit('settings_saved');
        return self::admin_settings();
    }

    private static function audit($action) {
        $events = (array) get_option('tripanza_site_controls_audit', array());
        $events[] = array('action' => $action, 'user_id' => get_current_user_id(), 'at' => gmdate('c'));
        update_option('tripanza_site_controls_audit', array_slice($events, -50), false);
    }

    public static function purge($request) {
        $permission = self::require_admin();
        if (is_wp_error($permission)) return $permission;
        $input = $request->get_json_params();
        $scope = is_array($input) && is_string($input['scope'] ?? null) ? $input['scope'] : '';
        if (!in_array($scope, array('all', 'tours', 'reels', 'hosts', 'site', 'bookings', 'browser', 'pdf', 'pdf_all', 'page_cache'), true)) return new WP_Error('tripanza_scope', 'Invalid cache scope.', array('status' => 400));
        $details = array();
        if ($scope === 'hosts' || $scope === 'all') delete_transient('tripanza_headless_host_league_' . wp_date('Y-m'));
        if ($scope === 'pdf' || $scope === 'pdf_all') {
            if (!function_exists('tripanza_clear_post_pdf_cache')) return new WP_Error('tripanza_pdf_unavailable', 'The PDF cache module is not installed.', array('status' => 503));
            $id = absint($input['tour_id'] ?? 0);
            if ($scope === 'pdf' && (!$id || get_post_type($id) !== 'st_tours')) return new WP_Error('tripanza_tour', 'Enter an existing tour ID.', array('status' => 400));
            global $wpdb;
            $cursor = absint($input['cursor'] ?? 0);
            $ids = $scope === 'pdf' ? array($id) : $wpdb->get_col($wpdb->prepare("SELECT ID FROM {$wpdb->posts} WHERE post_type = 'st_tours' AND ID > %d ORDER BY ID ASC LIMIT 20", $cursor));
            $count = 0;
            foreach ($ids as $tour_id) $count += (int) tripanza_clear_post_pdf_cache(absint($tour_id));
            $details = array('files' => $count, 'tours' => count($ids), 'cursor' => $ids ? absint(end($ids)) : $cursor, 'done' => $scope === 'pdf' || count($ids) < 20);
        }
        if ($scope === 'page_cache') {
            if (!self::purge_page_cache()) return new WP_Error('tripanza_page_cache_unavailable', 'No supported WordPress page-cache plugin detected.', array('status' => 503));
        }
        // Rotate only app cache identity. Never flush all WP objects/transients:
        // they contain login sessions, OTPs, rate limits and payment idempotency.
        if (in_array($scope, array('all', 'browser', 'bookings'), true)) {
            $settings = self::settings();
            $settings['cache_revision'] = wp_generate_uuid4();
            $settings['revision'] = wp_generate_uuid4();
            update_option(self::OPTION, $settings, false);
        }
        self::audit('purge_' . $scope);
        return self::response(array_merge(array('ok' => true, 'scope' => $scope), $details));
    }

    public static function leaderboard_read($value) {
        $settings = self::settings();
        // A non-false non-array skips storage but makes the existing API rebuild.
        return !$settings['public_cache_enabled'] || $settings['leaderboard_cache_seconds'] === 0 ? null : $value;
    }

    private static function purge_page_cache() {
        $ran = false;
        if (defined('LSCWP_V')) { do_action('litespeed_purge_all'); $ran = true; }
        if (function_exists('rocket_clean_domain')) { rocket_clean_domain(); $ran = true; }
        // W3TC's flush-all also flushes objects/auth transients. Posts-only
        // dispatch is restricted to the page cache, preserving active sessions.
        if (has_action('w3tc_flush_posts')) { do_action('w3tc_flush_posts', array('only' => 'pagecache')); $ran = true; }
        return $ran;
    }

    public static function leaderboard_ttl($expiration) {
        // WP expiration=0 means forever, so disabled cache uses a one-second
        // write and the pre_transient filter always bypasses it on reads.
        return max(1, (int) self::settings()['leaderboard_cache_seconds']);
    }

    public static function gate_rest($result, $server, $request) {
        $route = $request->get_route();
        if (!self::settings()['host_enabled'] && preg_match('#^/tripanza-headless/v1/host(?:/|$)#', $route)) return new WP_Error('tripanza_host_disabled', 'The Host feature is currently disabled.', array('status' => 503));
        return $result;
    }

    public static function private_headers($response, $server, $request) {
        if (preg_match('#^/tripanza-headless/v1/(?:settings/|admin/|host(?:/|$))#', $request->get_route())) {
            $response->header('Cache-Control', 'private, no-store, max-age=0');
        }
        return $response;
    }

    public static function gate_pages() {
        $path = trim((string) wp_parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '/');
        $pages = array('host', 'host-register', 'host-dashboard', 'admin-host-trips', 'poster-download', 'add-your-own-trip', 'host-reels', 'host-customer-booking-history', 'host-payout-details', 'host-wallet');
        $is_host = isset($_GET['tripanza_host_studio']) || get_query_var('partner_reels') || get_query_var('partner_slug') || get_query_var('partner_user') || in_array($path, $pages, true) || strpos($path, 'host/') === 0;
        $template = basename((string) get_page_template_slug());
        $is_host = $is_host || in_array($template, array('page-host-tripanza.php', 'page-host-register.php', 'page-host-reels.php', 'host-partner-profile.php', 'tripanza-host-dashboard.php', 'tripanza-host-payout.php', 'tripanza-host-customer-booking-history.php', 'tripanza-host-share-cards.php', 'Tripanza-template-create-tour.php', 'admin-page-host-trips.php', 'admin-page-host-trips (1).php'), true);
        if (!$is_host) return;
        nocache_headers();
        if (!defined('DONOTCACHEPAGE')) define('DONOTCACHEPAGE', true);
        do_action('litespeed_control_set_nocache', 'Tripanza Host access must be checked live');
        if (self::settings()['host_enabled']) return;
        if (isset($_GET['tripanza_host_studio'])) { header('X-Tripanza-Studio: 1'); wp_send_json_error('The Host feature is currently disabled.', 503); }
        wp_die('The Host feature is currently disabled. Your existing trips and bookings are safe.', 'Tripanza Host', array('response' => 503));
    }

    public static function gate_ajax() {
        if (!wp_doing_ajax() || self::settings()['host_enabled']) return;
        $action = sanitize_key(wp_unslash($_REQUEST['action'] ?? ''));
        if (in_array($action, array('tripanza_host_reel_publish', 'tripanza_host_reel_delete'), true)) wp_send_json_error('The Host feature is currently disabled.', 503);
    }

    public static function admin_menu() {
        add_options_page('Tripanza Site Controls', 'Tripanza Site Controls', 'manage_options', 'tripanza-site-controls', array(__CLASS__, 'admin_page'));
    }

    public static function admin_page() {
        if (!current_user_can('manage_options')) return;
        $s = self::settings();
        echo '<div class="wrap"><h1>Tripanza Site Controls</h1><p>These settings also power the Next.js /admin/settings page. Disabling Host blocks public and private Host routes without deleting data.</p><form method="post" action="' . esc_url(admin_url('admin-post.php')) . '">';
        wp_nonce_field('tripanza_site_controls');
        echo '<input type="hidden" name="action" value="tripanza_site_controls"><input type="hidden" name="revision" value="' . esc_attr($s['revision']) . '"><table class="form-table">';
        foreach (array('host_enabled' => 'Host feature enabled', 'public_cache_enabled' => 'Public API caching enabled') as $key => $label) echo '<tr><th>' . esc_html($label) . '</th><td><input type="checkbox" name="' . esc_attr($key) . '" value="1" ' . checked($s[$key], true, false) . '></td></tr>';
        foreach (self::defaults() as $key => $value) {
            if (substr($key, -8) !== '_seconds') continue;
            echo '<tr><th><label for="' . esc_attr($key) . '">' . esc_html(ucwords(str_replace('_', ' ', $key))) . '</label></th><td><input id="' . esc_attr($key) . '" type="number" min="0" name="' . esc_attr($key) . '" value="' . esc_attr($s[$key]) . '"> seconds (0 disables this cache)</td></tr>';
        }
        echo '</table><p>Authentication, checkout, payments and private Host APIs are always uncached. Cache deletion controls are available in the Next.js admin page.</p>';
        submit_button('Save settings');
        echo '</form></div>';
    }

    public static function admin_save() {
        if (!current_user_can('manage_options')) wp_die('Administrator access required.', '', array('response' => 403));
        check_admin_referer('tripanza_site_controls');
        $input = array();
        foreach (self::defaults() as $key => $value) {
            if (substr($key, -8) === '_seconds') $input[$key] = (int) ($_POST[$key] ?? -1);
        }
        $input['host_enabled'] = isset($_POST['host_enabled']);
        $input['public_cache_enabled'] = isset($_POST['public_cache_enabled']);
        $input['revision'] = sanitize_text_field(wp_unslash($_POST['revision'] ?? ''));
        $request = new WP_REST_Request('POST');
        $request->set_header('content-type', 'application/json');
        $request->set_body(wp_json_encode($input));
        $result = self::save($request);
        if (is_wp_error($result)) wp_die(esc_html($result->get_error_message()), '', array('response' => 400));
        wp_safe_redirect(admin_url('options-general.php?page=tripanza-site-controls&saved=1'));
        exit;
    }
}
add_action('plugins_loaded', array('Tripanza_Site_Controls', 'init'), 30);
