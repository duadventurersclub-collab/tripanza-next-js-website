<?php
defined("ABSPATH") || exit;
function tripanza_native_generate_holidays($preset_type) {
        $openai_key = get_option( 'whatsapp_ai_openai_api_key' );
        if ( empty( $openai_key ) ) {
            return new WP_Error("tripanza_ai", 'Configure the WordPress AI API key first.' , array("status" => 503));
        }

        // Preset type is validated by the protected API.

        switch ($preset_type) {
            case 'du':
                $preset_desc = "Delhi University (DU) academic calendar breaks, exam schedules, and student planning windows";
                $default_cat = "du";
                break;
            case 'ipu':
                $preset_desc = "GGSIPU academic calendar breaks, sports meets, and student planning windows in Delhi NCR";
                $default_cat = "ipu";
                break;
            case 'amity':
                $preset_desc = "Amity University academic calendar breaks, founder's day weekend, and student planning windows";
                $default_cat = "amity";
                break;
            case 'mumbai':
                $preset_desc = "Mumbai & Pune college student and youth booking windows, monsoon planning peaks, and regional festival breaks";
                $default_cat = "mumbai";
                break;
            case 'gujarat':
                $preset_desc = "Gujarat (Ahmedabad, Surat, Vadodara) youth and student academic calendar planning windows and festival breaks";
                $default_cat = "gujarat";
                break;
            case 'bangalore':
                $preset_desc = "Bangalore & Chennai IT corporate 9-5 salary-cycle booking surges and tech-hub long weekend planning windows";
                $default_cat = "bangalore";
                break;
            case 'corporate':
                $preset_desc = "Corporate 9-5 young professional salary-week booking surges and leave-bridging windows across major Indian business hubs";
                $default_cat = "corporate";
                break;
            case 'festive':
                $preset_desc = "Major Indian festive advance planning windows and holiday bridge periods for youth aged 18-35";
                $default_cat = "festive";
                break;
            case 'long_weekends':
            default:
                $preset_desc = "Upcoming general Indian public long weekends and leave-bridging planning windows for youth aged 18-35 across Tier 1 & 2 cities";
                $default_cat = "general";
                break;
        }

        $prompt = "Generate a JSON array of 10 to 15 upcoming high-intent booking and planning windows specifically for: {$preset_desc}. Target audience: Youth aged 18-35 (College students & 9-5 corporate workers) originating from Tier 1 & 2 hubs (Mumbai, Pune, Ahmedabad, Hyderabad, Indore, Bhopal, Delhi NCR, Chandigarh, Ambala, Bangalore, Chennai). Base these opportunities strictly on behavioral planning trends (such as corporate salary cycles, exam schedule releases, festival planning windows, and single-day leave-bridging opportunities). DO NOT include specific destination names or trip locations.
Each object must contain exactly four keys:
1. 'date': formatted string e.g. 'Aug 14 - Aug 17' or 'Oct 2 - Oct 6'
2. 'name': planning window title e.g. 'Salary-Week Long Weekend Window' or 'Mid-Sem Exam Break Planning Window'
3. 'desc': concise trend-based pitch e.g. '4 Days (Thu-Sun) - High corporate booking surge during salary week'
4. 'category': MUST be one of 'general', 'festive', 'du', 'ipu', 'amity', 'mumbai', 'gujarat', 'bangalore', 'corporate', 'custom' (set appropriately, defaulting to '{$default_cat}')

Output ONLY valid, raw JSON array without any Markdown backticks or extra prose.";

        $response = wp_remote_post( 'https://api.openai.com/v1/chat/completions', array(
            'headers' => array(
                'Authorization' => 'Bearer ' . trim( $openai_key ),
                'Content-Type'  => 'application/json',
            ),
            'body'    => wp_json_encode( array(
                'model'       => 'gpt-4o-mini',
                'messages'    => array(
                    array( 'role' => 'user', 'content' => $prompt )
                ),
                'temperature' => 0.7,
            ) ),
            'timeout' => 30,
        ) );

        if ( is_wp_error( $response ) ) {
            return new WP_Error("tripanza_ai", $response->get_error_message() , array("status" => 502));
        }
        if (wp_remote_retrieve_response_code($response) !== 200) return new WP_Error('tripanza_ai_response', 'The AI service is unavailable. Check its configuration and try again.', array('status' => 502));

        $body = wp_remote_retrieve_body( $response );
        $json_data = json_decode( $body, true );

        if ( isset( $json_data['choices'][0]['message']['content'] ) ) {
            $content = trim( $json_data['choices'][0]['message']['content'] );
            $content = preg_replace( '/^```(?:json)?\s*/i', '', $content );$content = preg_replace( '/\s*```$/i', '', $content );

            $parsed_holidays = json_decode( trim($content), true );
            $sanitized_new_holidays = array();

            if ( is_array( $parsed_holidays ) && ! empty( $parsed_holidays ) ) {
                foreach ( $parsed_holidays as $item ) {
                    if (is_array($item) && isset($item['date'], $item['name'], $item['desc'], $item['category']) && is_string($item['date']) && is_string($item['name']) && is_string($item['desc']) && is_string($item['category']) && strlen($item['date']) <= 100 && strlen($item['name']) <= 300 && strlen($item['desc']) <= 2000 && in_array($item['category'], array('general', 'festive', 'du', 'ipu', 'amity', 'mumbai', 'gujarat', 'bangalore', 'corporate', 'custom'), true)) {
                        $sanitized_new_holidays[] = array(
                            'date'     => sanitize_text_field( $item['date'] ),
                            'name'     => sanitize_text_field( $item['name'] ),
                            'desc'     => sanitize_text_field( $item['desc'] ),
                            'category' => sanitize_text_field( $item['category'] ),
                        );
                    }
                }
            }


            if (!$sanitized_new_holidays) return new WP_Error('tripanza_ai_parse', 'No planning windows were returned.', array('status' => 502));
            return array_slice($sanitized_new_holidays, 0, 30);
        }
        return new WP_Error('tripanza_ai_response', 'The AI service did not return planning windows.', array('status' => 502));
}
