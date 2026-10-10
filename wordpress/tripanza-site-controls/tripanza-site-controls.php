<?php
/**
 * Plugin Name: Tripanza Site Controls
 * Description: Administrator-only cache, feature, content, maintenance and operational controls for Tripanza Next.js.
 * Version: 1.5.0
 * Requires PHP: 7.4
 */
defined('ABSPATH') || exit;

final class Tripanza_Site_Controls {
    const OPTION = 'tripanza_site_controls_v1';
    const NS = 'tripanza-headless/v1';
    const VERSION = '1.5.0';

    private static function homepage_section_keys() {
        return array('hero', 'departures', 'deals', 'trips', 'destinations', 'reels', 'budget', 'quick', 'gallery', 'stays');
    }

    private static function default_homepage_sections() {
        $sections = array();
        foreach (self::homepage_section_keys() as $key) $sections[$key] = array('mode' => 'automatic', 'slugs' => array(), 'taxonomy' => '', 'term' => '');
        return $sections;
    }

    public static function defaults() {
        return array('host_enabled' => true, 'public_cache_enabled' => true,
            'ai_chat_enabled' => true, 'reels_enabled' => true, 'pdf_downloads_enabled' => true, 'new_bookings_enabled' => true,
            'admin_dashboard_enabled' => true, 'admin_booking_history_enabled' => true,
            'admin_booking_create_enabled' => true, 'admin_booking_editor_enabled' => true,
            'maintenance_enabled' => false, 'maintenance_message' => 'We are making Tripanza even better. Please check back shortly.',
            'announcement_enabled' => false, 'announcement_text' => '', 'announcement_link' => '', 'featured_tour_slugs' => '',
            'homepage_sections' => self::default_homepage_sections(),
            'contact_email' => 'hello@tripanza.com', 'contact_phone' => '+918130117254', 'contact_address' => 'Dwarka, Delhi NCR, India',
            'whatsapp_number' => '918130117254', 'instagram_url' => '', 'facebook_url' => '', 'error_alerts_enabled' => false, 'alert_email' => '',
            'seo_site_url' => '', 'ai_search_crawlers_enabled' => true, 'ai_training_crawlers_enabled' => true,
            'ga4_measurement_id' => '', 'meta_pixel_id' => '', 'google_site_verification' => '',
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
        add_action('save_post_st_tours', array(__CLASS__, 'clear_homepage_catalog'));
        add_action('before_delete_post', array(__CLASS__, 'clear_homepage_catalog_for_post'));
        add_action('set_object_terms', array(__CLASS__, 'clear_homepage_catalog_for_terms'));
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
        register_rest_route(self::NS, '/homepage/catalog', array('methods' => 'GET', 'callback' => array(__CLASS__, 'homepage_catalog'), 'permission_callback' => '__return_true'));
        register_rest_route(self::NS, '/admin/settings', array(
            array('methods' => 'GET', 'callback' => array(__CLASS__, 'admin_settings'), 'permission_callback' => array(__CLASS__, 'require_admin')),
            array('methods' => 'POST', 'callback' => array(__CLASS__, 'save'), 'permission_callback' => array(__CLASS__, 'require_admin')),
        ));
        register_rest_route(self::NS, '/admin/cache', array('methods' => 'POST', 'callback' => array(__CLASS__, 'purge'), 'permission_callback' => array(__CLASS__, 'require_admin')));
        register_rest_route(self::NS, '/admin/operations', array('methods' => 'GET', 'callback' => array(__CLASS__, 'operations'), 'permission_callback' => array(__CLASS__, 'require_admin')));
        register_rest_route(self::NS, '/monitoring/event', array('methods' => 'POST', 'callback' => array(__CLASS__, 'monitor_event'), 'permission_callback' => array(__CLASS__, 'require_monitor')));
    }

    private static function response($data) {
        nocache_headers();
        return new WP_REST_Response($data, 200, array('Cache-Control' => 'private, no-store, max-age=0'));
    }

    public static function public_settings() {
        $settings = self::settings();
        unset($settings['updated_by'], $settings['alert_email'], $settings['error_alerts_enabled']);
        return self::response($settings);
    }

    public static function admin_settings() {
        return self::response(array('settings' => self::settings(), 'controls_version' => self::VERSION, 'capabilities' => array(
            'pdf' => function_exists('tripanza_clear_post_pdf_cache'),
            'page_cache' => defined('LSCWP_V') || function_exists('rocket_clean_domain') || (bool) has_action('w3tc_flush_posts'),
        )));
    }

    public static function homepage_catalog() {
        $cached = get_transient('tripanza_homepage_catalog_v1');
        if (is_array($cached) && isset($cached['tours'], $cached['taxonomies'])) return self::response($cached);
        $taxonomies = array_filter(get_object_taxonomies('st_tours', 'objects'), static function ($taxonomy) {
            return !empty($taxonomy->public);
        });
        $taxonomy_names = array_keys($taxonomies);
        $posts = get_posts(array('post_type' => 'st_tours', 'post_status' => 'publish', 'posts_per_page' => -1,
            'orderby' => 'date', 'order' => 'DESC', 'fields' => 'ids', 'no_found_rows' => true));
        $items = array();
        foreach ($posts as $post_id) {
            $terms = array();
            foreach ($taxonomy_names as $taxonomy_name) {
                $assigned = wp_get_post_terms($post_id, $taxonomy_name);
                if (is_wp_error($assigned) || !$assigned) continue;
                $terms[$taxonomy_name] = array_map(static function ($term) {
                    return array('id' => (int) $term->term_id, 'slug' => $term->slug, 'name' => $term->name);
                }, $assigned);
            }
            $items[] = array('id' => (int) $post_id, 'slug' => get_post_field('post_name', $post_id),
                'title' => get_the_title($post_id), 'terms' => $terms);
        }
        $groups = array();
        foreach ($taxonomies as $taxonomy) {
            $terms = get_terms(array('taxonomy' => $taxonomy->name, 'hide_empty' => true));
            if (is_wp_error($terms) || !$terms) continue;
            $groups[] = array('slug' => $taxonomy->name, 'label' => $taxonomy->labels->name,
                'terms' => array_map(static function ($term) {
                    return array('id' => (int) $term->term_id, 'slug' => $term->slug, 'name' => $term->name);
                }, $terms));
        }
        $result = array('tours' => $items, 'taxonomies' => $groups);
        set_transient('tripanza_homepage_catalog_v1', $result, 5 * MINUTE_IN_SECONDS);
        return self::response($result);
    }

    public static function clear_homepage_catalog() {
        delete_transient('tripanza_homepage_catalog_v1');
    }

    public static function clear_homepage_catalog_for_post($post_id) {
        if (get_post_type($post_id) === 'st_tours') self::clear_homepage_catalog();
    }

    public static function clear_homepage_catalog_for_terms($object_id) {
        if (get_post_type($object_id) === 'st_tours') self::clear_homepage_catalog();
    }

    public static function save($request) {
        $permission = self::require_admin();
        if (is_wp_error($permission)) return $permission;
        $input = $request->get_json_params();
        if (!is_array($input)) return new WP_Error('tripanza_input', 'Invalid settings.', array('status' => 400));
        $settings = self::settings();
        $before = $settings;
        $host_was_enabled = $settings['host_enabled'];
        if (($input['revision'] ?? '') !== $settings['revision']) return new WP_Error('tripanza_conflict', 'Settings changed in another window. Reload before saving.', array('status' => 409));
        foreach (array('host_enabled', 'public_cache_enabled') as $key) {
            if (!isset($input[$key]) || !is_bool($input[$key])) return new WP_Error('tripanza_input', 'Invalid toggle: ' . $key, array('status' => 400));
            $settings[$key] = $input[$key];
        }
        foreach (array('ai_chat_enabled', 'ai_search_crawlers_enabled', 'ai_training_crawlers_enabled', 'reels_enabled', 'pdf_downloads_enabled', 'new_bookings_enabled', 'maintenance_enabled', 'announcement_enabled', 'error_alerts_enabled', 'admin_dashboard_enabled', 'admin_booking_history_enabled', 'admin_booking_create_enabled', 'admin_booking_editor_enabled') as $key) {
            if (!array_key_exists($key, $input)) continue; // Older clients preserve new settings.
            if (!is_bool($input[$key])) return new WP_Error('tripanza_input', 'Invalid toggle: ' . $key, array('status' => 400));
            $settings[$key] = $input[$key];
        }
        $lengths = array('maintenance_message' => 500, 'announcement_text' => 300, 'announcement_link' => 500, 'featured_tour_slugs' => 1200,
            'contact_email' => 254, 'contact_phone' => 25, 'contact_address' => 300, 'whatsapp_number' => 15, 'instagram_url' => 500, 'facebook_url' => 500, 'alert_email' => 254,
            'seo_site_url' => 255, 'ga4_measurement_id' => 24, 'meta_pixel_id' => 30, 'google_site_verification' => 180);
        foreach ($lengths as $key => $max) {
            if (!array_key_exists($key, $input)) continue;
            if (!is_string($input[$key]) || strlen($input[$key]) > $max) return new WP_Error('tripanza_input', 'Invalid or oversized field: ' . $key, array('status' => 400));
            $value = trim(sanitize_text_field($input[$key]));
            if (in_array($key, array('contact_email', 'alert_email'), true) && (($key === 'contact_email' && $value === '') || ($value !== '' && !is_email($value)))) return new WP_Error('tripanza_input', 'Enter a valid email: ' . $key, array('status' => 400));
            if ($key === 'contact_phone' && !preg_match('/^\+?[1-9][0-9]{6,14}$/D', $value)) return new WP_Error('tripanza_input', 'Use a phone number with country code and no spaces.', array('status' => 400));
            if ($key === 'whatsapp_number' && !preg_match('/^[1-9][0-9]{6,14}$/D', $value)) return new WP_Error('tripanza_input', 'Use WhatsApp digits with country code.', array('status' => 400));
            if ($key === 'seo_site_url' && $value !== '') {
                $origin = wp_parse_url($value);
                if (!$origin || ($origin['scheme'] ?? '') !== 'https' || empty($origin['host']) || isset($origin['user']) || isset($origin['pass']) || !empty($origin['query']) || !empty($origin['fragment']) || !in_array($origin['path'] ?? '', array('', '/'), true)) return new WP_Error('tripanza_input', 'Canonical site URL must be an HTTPS origin without a path, query or fragment.', array('status' => 400));
                $value = untrailingslashit(esc_url_raw($value, array('https')));
            }
            if ($key === 'ga4_measurement_id' && $value !== '' && !preg_match('/^G-[A-Z0-9]{4,20}$/D', $value)) return new WP_Error('tripanza_input', 'Enter a valid GA4 Measurement ID beginning G-.', array('status' => 400));
            if ($key === 'meta_pixel_id' && $value !== '' && !preg_match('/^[0-9]{5,30}$/D', $value)) return new WP_Error('tripanza_input', 'Enter a valid numeric Meta Pixel ID.', array('status' => 400));
            if ($key === 'google_site_verification' && $value !== '' && !preg_match('/^[A-Za-z0-9_-]{10,180}$/D', $value)) return new WP_Error('tripanza_input', 'Enter only the Google verification content token, not the full HTML tag.', array('status' => 400));
            if (in_array($key, array('announcement_link', 'instagram_url', 'facebook_url'), true) && $value !== '') {
                $local = $key === 'announcement_link' && preg_match('#^/(?!/)[a-zA-Z0-9/_-]*$#D', $value);
                $url = wp_parse_url($value);
                if (!$local && (!$url || ($url['scheme'] ?? '') !== 'https' || empty($url['host']) || isset($url['user']) || isset($url['pass']))) return new WP_Error('tripanza_input', 'Links must use HTTPS (or a local path for announcements).', array('status' => 400));
            }
            if ($key === 'featured_tour_slugs') {
                $slugs = array_values(array_filter(array_map('trim', explode(',', $value)), 'strlen'));
                if (count($slugs) > 12) return new WP_Error('tripanza_input', 'Choose at most 12 featured tours.', array('status' => 400));
                foreach ($slugs as $slug) {
                    $tour = get_page_by_path($slug, OBJECT, 'st_tours');
                    if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $slug) || !$tour || $tour->post_status !== 'publish') return new WP_Error('tripanza_input', 'Featured tour must be a published tour slug: ' . $slug, array('status' => 400));
                }
                $value = implode(', ', array_unique($slugs));
            }
            $settings[$key] = $value;
        }
        if (array_key_exists('homepage_sections', $input)) {
            if (!is_array($input['homepage_sections']) || array_diff(array_keys($input['homepage_sections']), self::homepage_section_keys()))
                return new WP_Error('tripanza_input', 'Invalid homepage sections.', array('status' => 400));
            $rules = self::default_homepage_sections();
            foreach ($rules as $key => $default_rule) {
                $rule = $input['homepage_sections'][$key] ?? $default_rule;
                if (!is_array($rule) || !in_array($rule['mode'] ?? '', array('automatic', 'manual', 'category'), true))
                    return new WP_Error('tripanza_input', 'Invalid homepage mode: ' . $key, array('status' => 400));
                $mode = $rule['mode'];
                $slugs = $rule['slugs'] ?? array();
                if (!is_array($slugs) || count($slugs) > 12) return new WP_Error('tripanza_input', 'Choose at most 12 tours per section.', array('status' => 400));
                $clean_slugs = array();
                foreach ($slugs as $slug) {
                    if (!is_string($slug) || !preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $slug))
                        return new WP_Error('tripanza_input', 'Invalid tour slug.', array('status' => 400));
                    $tour = get_page_by_path($slug, OBJECT, 'st_tours');
                    if (!$tour || $tour->post_status !== 'publish') return new WP_Error('tripanza_input', 'Tour is not published: ' . $slug, array('status' => 400));
                    $clean_slugs[] = $slug;
                }
                $taxonomy_name = $rule['taxonomy'] ?? '';
                $term_slug = $rule['term'] ?? '';
                if (!is_string($taxonomy_name) || !is_string($term_slug) || strlen($taxonomy_name) > 100 || strlen($term_slug) > 200)
                    return new WP_Error('tripanza_input', 'Invalid homepage category.', array('status' => 400));
                if ($mode === 'manual' && !$clean_slugs) return new WP_Error('tripanza_input', 'Select at least one tour for ' . $key . '.', array('status' => 400));
                if ($mode === 'category') {
                    $taxonomy = get_taxonomy($taxonomy_name);
                    $term = $taxonomy ? get_term_by('slug', $term_slug, $taxonomy_name) : false;
                    if (!$taxonomy || empty($taxonomy->public) || !is_object_in_taxonomy('st_tours', $taxonomy_name) || !$term)
                        return new WP_Error('tripanza_input', 'Choose a valid tour category for ' . $key . '.', array('status' => 400));
                }
                $rules[$key] = array('mode' => $mode, 'slugs' => array_values(array_unique($clean_slugs)),
                    'taxonomy' => $mode === 'category' ? $taxonomy_name : '', 'term' => $mode === 'category' ? $term_slug : '');
            }
            $settings['homepage_sections'] = $rules;
        }
        if ($settings['maintenance_enabled'] && $settings['maintenance_message'] === '') return new WP_Error('tripanza_input', 'Enter a maintenance message.', array('status' => 400));
        if ($settings['announcement_enabled'] && $settings['announcement_text'] === '') return new WP_Error('tripanza_input', 'Enter announcement text.', array('status' => 400));
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
        if ($host_was_enabled !== $settings['host_enabled'] || $before !== $settings) self::purge_page_cache();
        $changes = array();
        foreach (self::defaults() as $key => $ignored) {
            if (in_array($key, array('revision', 'cache_revision', 'updated_at', 'updated_by'), true)) continue;
            if ($before[$key] !== $settings[$key]) $changes[$key] = array('from' => $before[$key], 'to' => $settings[$key]);
        }
        self::audit('settings_saved', $changes);
        self::notify_next_revalidation();
        return self::admin_settings();
    }

    private static function notify_next_revalidation() {
        $url = defined('TRIPANZA_NEXT_REVALIDATE_URL') ? (string) TRIPANZA_NEXT_REVALIDATE_URL : (string) get_option('tripanza_next_revalidate_url', '');
        $secret = defined('TRIPANZA_NEXT_REVALIDATE_SECRET') ? (string) TRIPANZA_NEXT_REVALIDATE_SECRET : (string) get_option('tripanza_next_revalidate_secret', '');
        if ($url === '' || $secret === '') return;
        // Same configured, authenticated endpoint as tour revalidation. Never
        // put the secret in a URL or follow a redirect to another destination.
        wp_remote_post(esc_url_raw($url), array(
            'timeout' => 1, 'blocking' => false, 'redirection' => 0,
            'headers' => array('Content-Type' => 'application/json', 'X-Tripanza-Revalidate-Secret' => $secret),
            'body' => wp_json_encode(array('source' => 'site-controls')),
        ));
    }

    private static function audit($action, $changes = array()) {
        $events = (array) get_option('tripanza_site_controls_audit', array());
        $events[] = array('action' => $action, 'user_id' => get_current_user_id(), 'actor' => wp_get_current_user()->display_name, 'at' => gmdate('c'), 'changes' => $changes);
        update_option('tripanza_site_controls_audit', array_slice($events, -100), false);
    }

    public static function operations() {
        $permission = self::require_admin();
        if (is_wp_error($permission)) return $permission;
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
        $plugins = array();
        foreach (get_plugins() as $file => $info) {
            if (stripos($info['Name'], 'Tripanza') === false) continue;
            $plugins[] = array('name' => sanitize_text_field($info['Name']), 'version' => sanitize_text_field($info['Version']), 'active' => is_plugin_active($file) || is_plugin_active_for_network($file));
        }
        global $wpdb, $wp_version;
        $events = array_values(array_filter((array) get_option('tripanza_site_controls_errors', array()), static function ($event) {
            return isset($event['last_at']) && strtotime($event['last_at']) >= time() - 30 * DAY_IN_SECONDS;
        }));
        return self::response(array('checked_at' => gmdate('c'), 'health' => array('wordpress_version' => $wp_version, 'php_version' => PHP_VERSION,
            'database' => (string) $wpdb->get_var('SELECT 1') === '1', 'plugins' => $plugins, 'monitoring_configured' => defined('TRIPANZA_MONITORING_SECRET') && strlen(TRIPANZA_MONITORING_SECRET) >= 32),
            'audit' => array_reverse((array) get_option('tripanza_site_controls_audit', array())), 'errors' => array_reverse($events)));
    }

    public static function require_monitor($request) {
        $secret = defined('TRIPANZA_MONITORING_SECRET') ? (string) TRIPANZA_MONITORING_SECRET : '';
        $timestamp = $request->get_header('x-tripanza-timestamp');
        $signature = $request->get_header('x-tripanza-signature');
        if (strlen($secret) < 32 || !ctype_digit((string) $timestamp) || abs(time() - (int) $timestamp) > 120 || !hash_equals(hash_hmac('sha256', $timestamp . '.' . $request->get_body(), $secret), (string) $signature)) {
            return new WP_Error('tripanza_monitor_auth', 'Monitoring signature required.', array('status' => 403));
        }
        return true;
    }

    public static function monitor_event($request) {
        $permission = self::require_monitor($request);
        if (is_wp_error($permission)) return $permission;
        $input = $request->get_json_params();
        // Only allow enumerated, non-personal classifications. Never accept
        // error messages, request URLs, headers, stack traces or user details.
        $code = is_array($input) ? ($input['code'] ?? '') : '';
        $area = is_array($input) ? ($input['area'] ?? '') : '';
        if (!in_array($code, array('server_error', 'upstream_error', 'payment_error'), true) || !in_array($area, array('tours', 'booking', 'payment', 'host', 'settings', 'chat', 'site'), true)) return new WP_Error('tripanza_monitor_input', 'Invalid error classification.', array('status' => 400));
        $events = array_values(array_filter((array) get_option('tripanza_site_controls_errors', array()), static function ($event) {
            return isset($event['last_at']) && strtotime($event['last_at']) >= time() - 30 * DAY_IN_SECONDS;
        }));
        $now = gmdate('c'); $index = null;
        foreach ($events as $i => $event) if ($event['code'] === $code && $event['area'] === $area) $index = $i;
        if ($index === null) { $events[] = array('code' => $code, 'area' => $area, 'count' => 0, 'first_at' => $now); $index = count($events) - 1; }
        $events[$index]['count']++; $events[$index]['last_at'] = $now;
        $settings = self::settings();
        if ($settings['error_alerts_enabled'] && !get_transient('tripanza_error_alert_cooldown')) {
            // A site-wide cooldown bounds alert storms to one mail / 15 minutes.
            set_transient('tripanza_error_alert_cooldown', true, 15 * MINUTE_IN_SECONDS);
            $recipient = $settings['alert_email'] ?: get_option('admin_email');
            $sent = wp_mail($recipient, 'Tripanza website error alert', 'A website error was reported. Area: ' . $area . '. Category: ' . $code . '. UTC: ' . $now . '. Review /admin/settings and your hosting logs. No customer details are included.');
            $events[$index]['mail_status'] = $sent ? 'accepted_by_mailer' : 'mailer_failed';
        }
        update_option('tripanza_site_controls_errors', array_slice($events, -100), false);
        return self::response(array('ok' => true));
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
        self::notify_next_revalidation();
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
        $s = self::settings();
        $admin_pages = array(
            '/tripanza-headless/v1/admin/workspace' => 'admin_dashboard_enabled',
            '/tripanza-headless/v1/admin/bookings' => 'admin_booking_history_enabled',
            '/tripanza-headless/v1/admin/bookings/create' => 'admin_booking_create_enabled',
        );
        $admin_flag = $admin_pages[$route] ?? (preg_match('#^/tripanza-headless/v1/admin/bookings/[1-9][0-9]*/editor$#D', $route) ? 'admin_booking_editor_enabled' : '');
        if ($admin_flag !== '' && !$s[$admin_flag]) return new WP_Error('tripanza_admin_page_disabled', 'This admin page is disabled in Site Settings.', array('status' => 503));
        if (!$s['host_enabled'] && preg_match('#^/tripanza-headless/v1/host(?:/|$)#', $route)) return new WP_Error('tripanza_host_disabled', 'The Host feature is currently disabled.', array('status' => 503));
        if (!$s['ai_chat_enabled'] && preg_match('#^/tripanza-ai/v1/(ask|sync-history)$#', $route)) return new WP_Error('tripanza_feature_disabled', 'AI chat is currently unavailable.', array('status' => 503));
        if (!$s['reels_enabled'] && preg_match('#^/tripanza-headless/v1/(meta-reels|host/(?:.*/)?reels)(?:/|$)#', $route)) return new WP_Error('tripanza_feature_disabled', 'Reels are currently unavailable.', array('status' => 503));
        if (!$s['pdf_downloads_enabled'] && $route === '/tripanza-headless/v1/itinerary-lead') return new WP_Error('tripanza_feature_disabled', 'Itinerary downloads are currently unavailable.', array('status' => 503));
        // Payment initiation/verification and existing order reads are not gated.
        if ((!$s['new_bookings_enabled'] || ($s['maintenance_enabled'] && !current_user_can('manage_options'))) && in_array($route, array('/tripanza-headless/v1/booking', '/tripanza-headless/v1/booking/quote', '/tripanza-ai/v1/ask'), true)) return new WP_Error('tripanza_feature_disabled', 'New bookings are temporarily paused.', array('status' => 503));
        return $result;
    }

    public static function private_headers($response, $server, $request) {
        if (preg_match('#^/tripanza-headless/v1/(?:settings/|admin/|monitoring/|host(?:/|$))#', $request->get_route())) {
            $response->header('Cache-Control', 'private, no-store, max-age=0');
        }
        return $response;
    }

    public static function gate_pages() {
        if (isset($_GET['generate_pdf']) && !self::settings()['pdf_downloads_enabled']) {
            nocache_headers();
            wp_die('Itinerary downloads are currently unavailable.', 'Tripanza', array('response' => 503));
        }
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
        if (!wp_doing_ajax()) return;
        $action = sanitize_key(wp_unslash($_REQUEST['action'] ?? ''));
        $s = self::settings();
        if ((!$s['host_enabled'] || !$s['reels_enabled']) && in_array($action, array('tripanza_host_reel_publish', 'tripanza_host_reel_delete'), true)) wp_send_json_error('The Host feature is currently disabled.', 503);
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
        foreach (self::defaults() as $key => $default) {
            if (!is_bool($default)) continue;
            $label = $key === 'ai_search_crawlers_enabled' ? 'Allow AI search crawlers' : ($key === 'ai_training_crawlers_enabled' ? 'Allow AI training crawlers' : ucwords(str_replace('_', ' ', $key)));
            echo '<tr><th>' . esc_html($label) . '</th><td><input type="checkbox" name="' . esc_attr($key) . '" value="1" ' . checked($s[$key], true, false) . '>';
            if ($key === 'ai_search_crawlers_enabled') echo '<p class="description">Controls documented automatic ChatGPT, Claude and Perplexity search bots on the Next.js domain. Google Search and its AI features use Googlebot and are not affected.</p>';
            if ($key === 'ai_training_crawlers_enabled') echo '<p class="description">Controls GPTBot, ClaudeBot and Google-Extended on the Next.js domain. Robots.txt is voluntary, not a security barrier.</p>';
            echo '</td></tr>';
        }
        foreach (array('maintenance_message', 'announcement_text', 'announcement_link', 'featured_tour_slugs', 'contact_email', 'contact_phone', 'contact_address', 'whatsapp_number', 'instagram_url', 'facebook_url', 'alert_email', 'seo_site_url', 'ga4_measurement_id', 'meta_pixel_id', 'google_site_verification') as $key) {
            echo '<tr><th><label for="' . esc_attr($key) . '">' . esc_html(ucwords(str_replace('_', ' ', $key))) . '</label></th><td><input class="regular-text" id="' . esc_attr($key) . '" name="' . esc_attr($key) . '" value="' . esc_attr($s[$key]) . '"></td></tr>';
        }
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
        $input = self::settings(); // Preserve advanced settings not shown by the fallback form.
        unset($input['homepage_sections']); // Preserve saved placement rules without revalidating hidden fields.
        foreach (self::defaults() as $key => $value) {
            if (substr($key, -8) === '_seconds') $input[$key] = (int) ($_POST[$key] ?? -1);
            if (is_bool($value)) $input[$key] = isset($_POST[$key]);
        }
        foreach (array('maintenance_message', 'announcement_text', 'announcement_link', 'featured_tour_slugs', 'contact_email', 'contact_phone', 'contact_address', 'whatsapp_number', 'instagram_url', 'facebook_url', 'alert_email', 'seo_site_url', 'ga4_measurement_id', 'meta_pixel_id', 'google_site_verification') as $key) {
            if (isset($_POST[$key]) && is_string($_POST[$key])) $input[$key] = wp_unslash($_POST[$key]);
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
