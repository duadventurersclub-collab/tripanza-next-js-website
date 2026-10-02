<?php
/*
Template Name: Tripanza Host Share Cards
*/

$current_user = wp_get_current_user();

/* SAVE POV TEXT */
if($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['trip_pov_text'])){
    $pov_nonce = sanitize_text_field(wp_unslash($_POST['tripanza_pov_nonce'] ?? ''));
    if (!wp_verify_nonce($pov_nonce, 'tripanza_original_pov')) wp_send_json_error('Refresh the studio and try again.', 403);
    update_user_meta(
        $current_user->ID,
        'trip_pov_text',
        sanitize_text_field(wp_unslash($_POST['trip_pov_text']))
    );
    $saved = true;
}

/* GET USER TOURS */
$query_args = [
    'post_type'      => 'st_tours',
    'posts_per_page' => -1
];

// Check user role to determine which tours to show
if ( current_user_can( 'administrator' ) ) {
    // Admins see all admin tours (but not partner tours)
    $admin_ids = get_users( [
        'role'   => 'administrator',
        'fields' => 'ID'
    ] );
    $query_args['author__in'] = $admin_ids;
} else {
    // Partners (non-admins) see only their own tours
    $query_args['author'] = $current_user->ID;
}

$tours = new WP_Query( $query_args );

$pov = get_user_meta($current_user->ID, 'trip_pov_text', true);
if(!$pov){
    $pov = "POV: I’m Hosting a Trip 🚀";
}

if ( ! function_exists( 'tz_clean_trip_title' ) ) {
    function tz_clean_trip_title( $title ) {
        $clean = (string) $title;
        $clean = preg_replace( '/\b\d+\s*[dn]\b/i', '', $clean );
        $clean = preg_replace( '/\b\d+\s*(?:days?|nights?)\b/i', '', $clean );
        $noise = array(
            'batch', 'girls trip', 'girls only', 'boys trip', 'group trip', 'weekend',
            'long weekend', 'ex-delhi', 'ex-mumbai', 'ex-bangalore', 'ex-pune',
            'ex-hyderabad', 'ex-kolkata', 'ex-chennai', 'special edition', 'edition',
            'package', 'tour', 'trip',
        );
        foreach ( $noise as $word ) {
            $clean = preg_replace( '/\b' . preg_quote( $word, '/' ) . '\b/i', '', $clean );
        }
        $clean = preg_replace( '/\s+/', ' ', trim( $clean ) );
        $clean = trim( $clean, " \t\n\r\0\x0B-–|," );
        return $clean !== '' ? $clean : (string) $title;
    }
}

if ( ! function_exists( 'tz_detect_trip_type' ) ) {
    function tz_detect_trip_type( $haystack ) {
        if ( preg_match( '/\b(girls?\s*trip|girls?\s*only|her\s*trip|ladies\s*trip|women\s*trip)\b/i', $haystack ) ) {
            return 'girls_trip';
        }
        if ( preg_match( '/\b(boys?\s*trip|lads?\s*trip|men\s*only)\b/i', $haystack ) ) {
            return 'boys_trip';
        }
        if ( preg_match( '/\b(nye|new\s*year|countdown|31st\s*dec)\b/i', $haystack ) ) {
            return 'nye';
        }
        if ( preg_match( '/\b(monsoon|rainy|rain\s*trip)\b/i', $haystack ) ) {
            return 'monsoon';
        }
        if ( preg_match( '/\b(solo|backpack|backpacking)\b/i', $haystack ) ) {
            return 'solo';
        }
        if ( preg_match( '/\b(honeymoon|couple)\b/i', $haystack ) ) {
            return 'couple';
        }
        return 'group';
    }
}

if ( ! function_exists( 'tz_detect_season' ) ) {
    function tz_detect_season( $departure_ts ) {
        if ( ! $departure_ts ) {
            return 'any';
        }
        $month = (int) date( 'n', $departure_ts );
        if ( in_array( $month, array( 12, 1, 2 ), true ) ) {
            return 'winter';
        }
        if ( in_array( $month, array( 3, 4, 5, 6 ), true ) ) {
            return 'summer';
        }
        if ( in_array( $month, array( 7, 8, 9 ), true ) ) {
            return 'monsoon';
        }
        return 'post_monsoon';
    }
}

if ( ! function_exists( 'tz_season_label' ) ) {
    function tz_season_label( $season ) {
        $labels = array(
            'winter'        => 'Winter — woolens, crisp air, blue hour, cozy layers',
            'summer'        => 'Summer — bright daylight, open skies, warm energy',
            'monsoon'       => 'Monsoon — mist, rain texture, moody greens, umbrellas',
            'post_monsoon'  => 'Post-monsoon — clear skies, fresh greens, golden evenings',
            'any'           => 'Match season subtly to departure dates',
        );
        return $labels[ $season ] ?? $labels['any'];
    }
}

if ( ! function_exists( 'tz_trip_type_label' ) ) {
    function tz_trip_type_label( $trip_type ) {
        $labels = array(
            'girls_trip' => 'Girls trip — friends, candid group energy, aspirational sisterhood vibe',
            'boys_trip'  => 'Boys trip — squad energy, adventure banter, confident group dynamic',
            'nye'        => 'New Year — countdown energy, gold accents, celebration mood',
            'monsoon'    => 'Monsoon escape — moody romance, rain-soaked calm, misty frames',
            'solo'       => 'Solo / backpack — one traveler, journal aesthetic, inner journey',
            'couple'     => 'Couple trip — intimate, romantic, shared-moment framing',
            'group'      => 'Youth group trip — friends, fun, safe community travel energy',
        );
        return $labels[ $trip_type ] ?? $labels['group'];
    }
}

if ( ! function_exists( 'tz_destination_region_catalog' ) ) {
    function tz_destination_region_catalog() {
        return array(
            'himalaya' => array(
                'patterns'    => 'spiti|himachal|manali|kasol|shimla|dharamshala|mcleod|bir billing|uttarakhand|uttrakhand|rishikesh|haridwar|auli|mussoorie|nainital|kashmir|gulmarg|pahalgam|ladakh|leh|sikkim|darjeeling|kinnaur|chopta|tirthan|jibhi|malana',
                'label'       => 'Himalayan highlands — peaks, pine forests, winding roads, mountain cafés',
                'palette'     => array( 'ice blue', 'pine green', 'mist white', 'warm sand accent' ),
                'landmarks'   => array( 'snow peaks', 'monasteries', 'winding mountain roads', 'valley viewpoints', 'riverside cafés' ),
                'culture'     => array( 'prayer flags', 'monasteries', 'local dhabas', 'bonfires', 'starry night skies' ),
                'food'        => array( 'momos', 'thukpa', 'maggi at dhabas', 'chai in mountain cafés' ),
                'transport'   => array( 'tempo traveller', 'bikes on cliff roads', 'shared cabs' ),
                'mood'        => array( 'raw', 'cosmic', 'off-grid', 'silent', 'adventurous' ),
                'weird_true'  => 'Kaza petrol-pump queue under milky way, or prayer flags cutting through cold wind',
                'avoid'       => array( 'beaches', 'palm trees', 'tropical neon', 'desert camels', 'European trams' ),
            ),
            'rajasthan' => array(
                'patterns'    => 'rajasthan|jaipur|jaisalmer|jodhpur|udaipur|pushkar|bikaner|mount abu|desert',
                'label'       => 'Rajasthan desert heritage — forts, dunes, colorful markets, royal warmth',
                'palette'     => array( 'sand gold', 'terracotta', 'deep maroon', 'ivory' ),
                'landmarks'   => array( 'sand dunes', 'fort silhouettes', 'havelis', 'stepwells', 'blue city lanes' ),
                'culture'     => array( 'turbans', 'camel safaris', 'folk music', 'lantern-lit courtyards' ),
                'food'        => array( 'dal baati', 'lassi', 'kachori', 'rooftop dinners' ),
                'transport'   => array( 'camel caravan', 'open jeep', 'vintage scooter in old city' ),
                'mood'        => array( 'royal', 'sun-drenched', 'storytelling', 'warm', 'cinematic' ),
                'weird_true'  => 'Blue-city lane lassi shop chalkboard, or lantern shadows on sandstone walls',
                'avoid'       => array( 'snow mountains', 'beach shacks', 'tropical palms', 'Japanese temples' ),
            ),
            'beach' => array(
                'patterns'    => 'goa|gokarna|andaman|lakshadweep|pondicherry beach|varkala|kovalam|tarkarli|maldives|phuket|krabi',
                'label'       => 'Coastal beach vibe — palms, sunsets, shacks, sea breeze freedom',
                'palette'     => array( 'teal ocean', 'coral', 'sunset orange', 'sand beige' ),
                'landmarks'   => array( 'palm-lined shores', 'beach shacks', 'cliffs at sunset', 'fishing boats' ),
                'culture'     => array( 'scooters by the shore', 'beach parties', 'bonfire nights', 'shack music' ),
                'food'        => array( 'seafood plates', 'kingfish fry', 'tropical cocktails (mock)' ),
                'transport'   => array( 'scooters', 'beach bikes', 'colorful taxis' ),
                'mood'        => array( 'free', 'sunny', 'carefree', 'youthful', 'salt-air' ),
                'weird_true'  => 'Empty monsoon-green shack with scooter in rain, or footprints at golden hour',
                'avoid'       => array( 'snow peaks', 'desert camels', 'prayer flags on peaks', 'European trams' ),
            ),
            'kerala' => array(
                'patterns'    => 'kerala|munnar|alleppey|alappuzha|kochi|cochin|wayanad|thekkady|varkala|kumarakom',
                'label'       => 'Kerala backwaters & greenery — houseboats, coconut groves, slow travel',
                'palette'     => array( 'emerald green', 'backwater teal', 'coconut brown', 'cream' ),
                'landmarks'   => array( 'houseboats', 'backwaters', 'tea gardens', 'Chinese fishing nets' ),
                'culture'     => array( 'Kathakali motifs', 'spice markets', 'monsoon mist over palms' ),
                'food'        => array( 'appam', 'puttu', 'sadhya', 'fresh coconut water' ),
                'transport'   => array( 'houseboat', 'local ferry', 'scooter through tea hills' ),
                'mood'        => array( 'slow', 'lush', 'serene', 'romantic', 'organic' ),
                'weird_true'  => 'Houseboat window reflection at dawn, or tea-picker silhouette in mist',
                'avoid'       => array( 'desert dunes', 'snow peaks', 'Dubai skyline', 'European cafés' ),
            ),
            'northeast' => array(
                'patterns'    => 'northeast|meghalaya|shillong|cherrapunji|kaziranga|assam|arunachal|tawang|nagaland|manipur|sikkim trek',
                'label'       => 'North East India — waterfalls, living root bridges, clouds in valleys',
                'palette'     => array( 'deep green', 'cloud grey', 'river blue', 'earth brown' ),
                'landmarks'   => array( 'waterfalls', 'living root bridges', 'bamboo houses', 'misty valleys' ),
                'culture'     => array( 'tribal textiles', 'cloud-covered hills', 'music around bonfires' ),
                'food'        => array( 'smoked pork', 'bamboo shoot dishes', 'local rice beer culture (subtle)' ),
                'transport'   => array( 'sumo jeeps', 'trekking trails', 'rope bridges' ),
                'mood'        => array( 'mystic', 'untouched', 'green', 'raw', 'immersive' ),
                'weird_true'  => 'Root bridge with single traveler scale, or clouds rolling through valley gap',
                'avoid'       => array( 'Rajasthan forts', 'Goa shacks', 'Dubai skyline', 'European streets' ),
            ),
            'europe' => array(
                'patterns'    => 'europe|spain|barcelona|madrid|italy|rome|milan|venice|florence|france|paris|amsterdam|switzerland|zurich|interlaken|greece|santorini|prague|vienna|budapest|london|uk trip',
                'label'       => 'European streets — cafés, trams, cathedrals, cobblestone wanderlust',
                'palette'     => array( 'warm stone', 'terracotta', 'soft blue', 'cream' ),
                'landmarks'   => array( 'café terraces', 'cathedrals', 'trams', 'cobblestone alleys', 'river bridges' ),
                'culture'     => array( 'street musicians', 'wine culture', 'fashion-forward locals', 'metro maps' ),
                'food'        => array( 'espresso', 'gelato', 'croissants', 'tapas plates' ),
                'transport'   => array( 'metro', 'vintage tram', 'rental bikes', 'train tickets' ),
                'mood'        => array( 'chic', 'wanderlust', 'cinematic', 'slow', 'aesthetic' ),
                'weird_true'  => 'Metro ticket stub on café table, or rain on cobblestones under warm lamp light',
                'avoid'       => array( 'Indian temples', 'desert camels', 'tropical beach shacks', 'prayer flags' ),
            ),
            'japan' => array(
                'patterns'    => 'japan|tokyo|osaka|kyoto|nara|fuji|hokkaido',
                'label'       => 'Japan — temples, neon alleys, cherry blossoms, bullet-train rhythm',
                'palette'     => array( 'sakura pink', 'indigo night', 'paper white', 'vermillion accent' ),
                'landmarks'   => array( 'torii gates', 'temple roofs', 'shinkansen', 'neon side streets' ),
                'culture'     => array( 'kimono textures', 'vending machines', 'zen gardens', 'convenience-store snacks' ),
                'food'        => array( 'ramen bowls', 'matcha', 'sushi counters', 'onigiri' ),
                'transport'   => array( 'bullet train', 'metro lines', 'bicycle by canal' ),
                'mood'        => array( 'minimal', 'electric', 'disciplined', 'dreamy', 'future-past' ),
                'weird_true'  => 'Lantern alley reflection in puddle, or Mt Fuji framed through train window',
                'avoid'       => array( 'Indian forts', 'Goa beaches', 'Rajasthan turbans', 'Dubai desert safari' ),
            ),
            'dubai' => array(
                'patterns'    => 'dubai|uae|abu dhabi|sharjah|desert safari dubai',
                'label'       => 'Dubai / UAE — skyline luxury, desert contrast, modern Arabian nights',
                'palette'     => array( 'gold sand', 'midnight blue', 'champagne', 'black accent' ),
                'landmarks'   => array( 'Burj Khalifa skyline', 'desert dunes', 'marina lights', 'old souk lanes' ),
                'culture'     => array( 'desert camps', 'luxury cars subtle', 'Arabian patterns', 'dhow boats' ),
                'food'        => array( 'shawarma', 'dates', 'Arabic coffee', 'luxury brunch spreads' ),
                'transport'   => array( 'desert SUV', 'metro', 'yacht silhouette (subtle)' ),
                'mood'        => array( 'luxury', 'contrast', 'glam', 'desert-night', 'premium' ),
                'weird_true'  => 'Desert camp fire under skyscrapers glow, or gold souk light on sand tones',
                'avoid'       => array( 'Himalayan snow', 'Kerala houseboats', 'European trams', 'Goa shacks' ),
            ),
            'southeast_asia' => array(
                'patterns'    => 'bali|thailand|bangkok|phuket|chiang mai|vietnam|hanoi|saigon|cambodia|angkor|malaysia|langkawi|bali ubud|seminyak',
                'label'       => 'Southeast Asia — tropical temples, scooters, cafés, island sunsets',
                'palette'     => array( 'jungle green', 'temple gold', 'ocean teal', 'sunset coral' ),
                'landmarks'   => array( 'temple gates', 'rice terraces', 'tropical beaches', 'night markets' ),
                'culture'     => array( 'scooters', 'offering baskets', 'beach clubs', 'island-hopping' ),
                'food'        => array( 'pad thai', 'satay', 'smoothie bowls', 'street noodles' ),
                'transport'   => array( 'scooter stacks', 'longtail boats', 'tuk-tuk' ),
                'mood'        => array( 'tropical', 'spiritual', 'social', 'sun-kissed', 'wander' ),
                'weird_true'  => 'Scooter helmet stack outside beach café, or temple mist at sunrise',
                'avoid'       => array( 'snow peaks', 'Rajasthan forts', 'European trams', 'Dubai skyline' ),
            ),
        );
    }
}

if ( ! function_exists( 'tz_match_destination_region' ) ) {
    function tz_match_destination_region( $haystack ) {
        $catalog  = tz_destination_region_catalog();
        $fallback = array(
            'key'         => 'generic',
            'label'       => 'Destination-specific — use the most iconic landmarks and culture of this place',
            'palette'     => array( 'pick 2–3 colors that match the location mood only' ),
            'landmarks'   => array( 'most iconic landmark(s) of the destination', 'local street life', 'signature landscape' ),
            'culture'     => array( 'local traditions', 'youth travel moments', 'authentic regional textures' ),
            'food'        => array( 'signature local dishes', 'street food cues' ),
            'transport'   => array( 'local transport icons', 'travel-in-motion moments' ),
            'mood'        => array( 'aspirational', 'authentic', 'youthful', 'immersive' ),
            'weird_true'  => 'One hyper-local detail only locals would recognize — subtle, not cliché',
            'avoid'       => array( 'mixing landmarks from different countries/regions', 'generic stock-travel symbols that do not match' ),
        );

        foreach ( $catalog as $key => $region ) {
            if ( preg_match( '/(?:' . $region['patterns'] . ')/i', $haystack ) ) {
                $region['key'] = $key;
                return $region;
            }
        }

        return $fallback;
    }
}

if ( ! function_exists( 'tz_build_headline_variants' ) ) {
    function tz_build_headline_variants( $location, $trip_type, $season ) {
        $loc       = strtoupper( trim( $location ) );
        $variants  = array(
            'LOST IN ' . $loc,
            $loc . ' CALLING',
            "LET'S GO " . $loc,
        );
        if ( $trip_type === 'girls_trip' ) {
            $variants[] = 'GIRLS TRIP · ' . $loc;
            $variants[] = 'HER ESCAPE · ' . $loc;
        } elseif ( $trip_type === 'boys_trip' ) {
            $variants[] = 'SQUAD TRIP · ' . $loc;
        } elseif ( $trip_type === 'nye' ) {
            $variants[] = 'NYE IN ' . $loc;
        } elseif ( $trip_type === 'solo' ) {
            $variants[] = 'SOLO IN ' . $loc;
        }
        if ( $season === 'monsoon' ) {
            $variants[] = 'MONSOON ESCAPE · ' . $loc;
        } elseif ( $season === 'winter' ) {
            $variants[] = 'WINTER IN ' . $loc;
        }
        $variants = array_values( array_unique( $variants ) );
        return array_slice( $variants, 0, 4 );
    }
}

if ( ! function_exists( 'tz_build_destination_profile' ) ) {
    function tz_build_destination_profile( $post_id, $title, $departure_ts = null ) {
        $destination_meta = trim( (string) get_post_meta( $post_id, '_st_tour_destination', true ) );
        $location         = $destination_meta !== '' ? $destination_meta : tz_clean_trip_title( $title );

        $category_names = array();
        $terms          = get_the_terms( $post_id, 'st_tour_type' );
        if ( ! empty( $terms ) && ! is_wp_error( $terms ) ) {
            foreach ( $terms as $term ) {
                $category_names[] = $term->name;
            }
        }

        $tour_tag = trim( (string) get_post_meta( $post_id, '_st_tour_tag', true ) );
        $haystack = strtolower( $location . ' ' . $title . ' ' . implode( ' ', $category_names ) . ' ' . $tour_tag );

        $trip_type = tz_detect_trip_type( $haystack );
        if ( $trip_type === 'group' && preg_match( '/\bmonsoon\b/i', $haystack ) ) {
            $trip_type = 'monsoon';
        }

        $season = tz_detect_season( $departure_ts );
        if ( preg_match( '/\bmonsoon\b/i', $haystack ) ) {
            $season = 'monsoon';
        } elseif ( preg_match( '/\b(winter|snow|december|january|february)\b/i', $haystack ) ) {
            $season = 'winter';
        }

        $region   = tz_match_destination_region( $haystack );
        $headlines = tz_build_headline_variants( $location, $trip_type, $season );

        return array(
            'location'    => $location,
            'region_key'  => $region['key'] ?? 'generic',
            'region'      => $region,
            'trip_type'   => $trip_type,
            'season'      => $season,
            'categories'  => $category_names,
            'headlines'   => $headlines,
        );
    }
}

if ( ! function_exists( 'tz_format_destination_block' ) ) {
    function tz_format_destination_block( array $profile, $visual_text = '' ) {
        $region = $profile['region'];

        $join = static function ( $items ) {
            if ( ! is_array( $items ) ) {
                return (string) $items;
            }
            return implode( ', ', array_filter( array_map( 'trim', $items ) ) );
        };

        $lines   = array();
        $lines[] = '--------------------------------------------------';
        $lines[] = 'DESTINATION PROFILE (AUTO-GENERATED — FOLLOW STRICTLY)';
        $lines[] = '--------------------------------------------------';
        $lines[] = '- Location: ' . $profile['location'];
        $lines[] = '- Region vibe: ' . $region['label'];
        $lines[] = '- Trip mood: ' . tz_trip_type_label( $profile['trip_type'] );
        $lines[] = '- Season cue: ' . tz_season_label( $profile['season'] );
        $lines[] = '- Palette lock (max 3): ' . $join( $region['palette'] );
        $lines[] = '- Visual anchors: ' . $join( $region['landmarks'] );
        $lines[] = '- Culture & texture: ' . $join( $region['culture'] );
        $lines[] = '- Food & local flavor: ' . $join( $region['food'] );
        $lines[] = '- Transport icons: ' . $join( $region['transport'] );
        $lines[] = '- Mood words: ' . $join( $region['mood'] );
        $lines[] = '- One subtle unexpected detail: ' . $region['weird_true'];
        $lines[] = '- Suggested headlines (pick ONE): ' . $join( $profile['headlines'] );
        $lines[] = '- DO NOT USE: ' . $join( $region['avoid'] );

        if ( ! empty( $profile['categories'] ) ) {
            $lines[] = '- Trip categories: ' . $join( $profile['categories'] );
        }

        if ( trim( (string) $visual_text ) !== '' ) {
            $lines[] = '- Host visual notes (priority — blend with profile):';
            $lines[] = trim( (string) $visual_text );
        }

        $lines[] = '';
        $lines[] = 'ANTI-GENERIC RULE:';
        $lines[] = 'If the poster could fit any random trip, include at least 2 elements from Visual anchors + Culture above. Never use items from DO NOT USE.';

        return implode( "\n", $lines );
    }
}

if ( ! function_exists( 'tz_share_parse_date' ) ) {
    function tz_share_parse_date( $value ) {
        $value = is_scalar( $value ) ? trim( (string) $value ) : '';
        if ( $value === '' ) {
            return 0;
        }
        if ( ctype_digit( $value ) && strlen( $value ) >= 9 && strlen( $value ) <= 10 ) {
            return (int) $value;
        }

        $timezone = wp_timezone();
        foreach ( array( '!Y-m-d', '!d/m/Y', '!d-m-Y', '!Y-m-d H:i', '!Y-m-d H:i:s', '!Y-m-d\TH:i', '!Y-m-d\TH:i:s' ) as $format ) {
            $date   = DateTimeImmutable::createFromFormat( $format, $value, $timezone );
            $errors = DateTimeImmutable::getLastErrors();
            if ( $date && ( ! $errors || ( ! $errors['warning_count'] && ! $errors['error_count'] ) ) ) {
                return $date->getTimestamp();
            }
        }
        return 0;
    }
}

if ( ! function_exists( 'tz_share_parse_duration' ) ) {
    function tz_share_parse_duration( $value ) {
        $raw    = trim( wp_strip_all_tags( (string) $value ) );
        $days   = 0;
        $nights = null;

        if ( preg_match( '/(\d+)\s*(?:days?|d)\b/i', $raw, $match ) ) {
            $days = (int) $match[1];
        } elseif ( ctype_digit( $raw ) ) {
            $days = (int) $raw;
        }
        if ( preg_match( '/(\d+)\s*(?:nights?|n)\b/i', $raw, $match ) ) {
            $nights = (int) $match[1];
        }
        if ( $days < 1 && null !== $nights ) {
            $days = $nights + 1;
        }
        if ( null === $nights && $days > 0 ) {
            $nights = max( 0, $days - 1 );
        }

        return array(
            'days'   => $days,
            'nights' => null === $nights ? 0 : $nights,
            'label'  => $days > 0 && null !== $nights ? sprintf( '%dN/%dD', $nights, $days ) : $raw,
        );
    }
}

if ( ! function_exists( 'tz_share_saved_inclusions' ) ) {
    function tz_share_saved_inclusions( $included, $excluded = '' ) {
        $to_lines = static function ( $value ) {
            $value = html_entity_decode( wp_strip_all_tags( (string) $value ), ENT_QUOTES, 'UTF-8' );
            $lines = preg_split( '/[\r\n]+/u', $value );
            $clean = array();
            foreach ( (array) $lines as $line ) {
                $line = trim( preg_replace( '/^[\s\-*•✓✔]+/u', '', $line ) );
                if ( $line !== '' ) {
                    $clean[] = $line;
                }
            }
            return array_values( array_unique( $clean ) );
        };

        $included = $to_lines( $included );
        $excluded = array_map( 'strtolower', $to_lines( $excluded ) );
        $included = array_values( array_filter( $included, static function ( $item ) use ( $excluded ) {
            return ! in_array( strtolower( $item ), $excluded, true );
        } ) );
        return array_slice( $included, 0, 6 );
    }
}

if ( ! function_exists( 'tz_format_package_night_scene' ) ) {
    function tz_format_package_night_scene( array $profile ) {
        $scenes = array(
            'himalaya'        => 'Mountain night — starry sky, cozy homestay/café glow, friends in jackets (bonfire ONLY if real mountain camp trip)',
            'rajasthan'       => 'Desert dusk/night — lanterns, folk evening, sand tones (desert campfire OK here only)',
            'beach'           => 'Beach night — palm silhouettes, starry sky, shack lights, friends on sand (NO mountain bonfire or snow)',
            'kerala'          => 'Backwater/houseboat dusk — calm water, palm silhouettes, soft golden-to-blue hour (NO bonfire, NO tents)',
            'northeast'       => 'Misty valley evening — clouds, green hills, camp bonfire acceptable if trek/camp trip',
            'europe'          => 'City night — warm street lamps, café terrace, cobblestones (NO bonfire, NO tents, NO beach)',
            'japan'           => 'Lantern/temple evening OR neon alley night (NO bonfire, NO desert)',
            'dubai'           => 'Desert camp at night OR marina/city skyline glow (campfire only in desert scene)',
            'southeast_asia'  => 'Tropical night — beach fire OR night market lights (match island/city from location)',
            'generic'         => 'Evening/night scene that matches DESTINATION PROFILE — never default to generic bonfire camp',
        );
        $key = $profile['region_key'] ?? 'generic';
        return $scenes[ $key ] ?? $scenes['generic'];
    }
}

if ( ! function_exists( 'tz_format_package_inclusions' ) ) {
    function tz_format_package_inclusions( array $inclusions ) {
        if ( empty( $inclusions ) ) {
            return 'PACKAGE INCLUSIONS: Nothing is saved in the st_tours inclusion fields. Omit the inclusion grid and do not invent services.';
        }

        $lines   = array();
        $lines[] = 'PACKAGE INCLUSIONS (use ONLY these saved st_tours inclusions):';
        foreach ( $inclusions as $i => $label ) {
            $lines[] = ( $i + 1 ) . '. ' . $label;
        }
        $lines[] = 'Use one matching icon per item. You may shorten a label without changing its meaning; never add or upgrade an inclusion.';

        return implode( "\n", $lines );
    }
}
?>
<script>window.TRIPANZA_STUDIO_NONCE = <?php echo wp_json_encode(wp_create_nonce('tripanza_original_studio_tools')); ?>;</script>

<!-- Use the matching workspace menu for the current role. -->
<!-- Host navigation is provided by the parent Next.js page. -->

<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer" />
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

:root {
    --share-bg: #f1f5f9;
    --share-ink: #0f172a;
    --share-muted: #64748b;
    --share-line: #e2e8f0;
    --share-card: #ffffff;
    --share-accent: #2563eb;
    --share-dark: #0b1220;
}

body:has(.tz-share-app),
body.tz-share-console {
    background: var(--share-bg) !important;
}

body:has(.tz-share-app) #st-content-wrapper,
body:has(.tz-share-app) .container,
body:has(.tz-share-app) .st-container,
body:has(.tz-share-app) .entry-content,
body.tz-share-console #st-content-wrapper,
body.tz-share-console .container {
    max-width: 100% !important;
    width: 100% !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
}

.tz-share-app,
.tz-share-app * {
    box-sizing: border-box;
}

.tz-share-app {
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: var(--share-ink);
    background: var(--share-bg);
    min-height: 100vh;
    padding-bottom: 48px;
}

/* Tripanza admin drawer buttons — keep above sticky topbar */
.admin-menu-btn,
.admin-share-btn {
    position: fixed !important;
    top: 13px !important;
    z-index: 50 !important;
}

.admin-menu-btn {
    left: 14px !important;
}

.admin-share-btn {
    right: 14px !important;
}

body:has(.admin-menu-btn) .tz-share-topbar {
    padding-left: 78px;
    padding-right: 72px;
}

body:has(.admin-menu-btn) .tz-share-topbar__brand {
    margin-left: 10px;
}

.tz-share-topbar {
    position: sticky;
    top: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    min-height: 64px;
    padding: 14px 56px 14px 56px;
    width: 100vw;
    margin: 0 calc(50% - 50vw) 20px;
    background: var(--share-dark);
    color: #fff;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.tz-share-topbar__brand {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
}

.tz-share-topbar__icon {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.tz-share-topbar h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 800;
    line-height: 1.2;
}

.tz-share-topbar p {
    margin: 2px 0 0;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.72);
}

.tz-share-topbar__badge {
    display: inline-flex;
    align-items: center;
    height: 30px;
    padding: 0 12px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
    color: #e2e8f0;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
}

.tz-share-wrap {
    width: min(1200px, 100%);
    margin: 0 auto;
    padding: 0 16px 24px;
}

.tz-share-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 16px;
}

.tz-share-search {
    position: relative;
    flex: 1 1 280px;
    min-width: 0;
}

.tz-share-search i {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--share-muted);
    font-size: 14px;
    pointer-events: none;
}

.tz-share-search input {
    width: 100%;
    height: 44px;
    padding: 0 14px 0 40px;
    border: 1px solid var(--share-line);
    border-radius: 12px;
    background: #fff;
    color: var(--share-ink);
    font: 500 14px Inter, sans-serif;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.tz-share-search input:focus {
    outline: none;
    border-color: var(--share-accent);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.tz-share-count {
    font-size: 12px;
    color: var(--share-muted);
    font-weight: 600;
}

.tz-share-count strong {
    color: var(--share-ink);
}

.tz-share-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 16px;
    margin-bottom: 20px;
}

.tz-share-card {
    background: var(--share-card);
    border: 1px solid var(--share-line);
    border-radius: 16px;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    transition: box-shadow 0.15s ease, transform 0.15s ease;
}

.tz-share-card:hover {
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
}

.tz-share-card__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
}

.tz-share-card__title {
    margin: 0;
    font-size: 17px;
    font-weight: 800;
    line-height: 1.35;
    color: var(--share-ink);
}

.tz-share-chip {
    display: inline-flex;
    align-items: center;
    height: 26px;
    padding: 0 10px;
    border-radius: 999px;
    background: #eff6ff;
    color: #1d4ed8;
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
    flex-shrink: 0;
}

.tz-share-card__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.tz-share-meta-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 8px;
    background: #f8fafc;
    border: 1px solid var(--share-line);
    font-size: 11px;
    color: var(--share-muted);
    font-weight: 600;
}

.tz-share-meta-pill i {
    color: #94a3b8;
    font-size: 10px;
}

.tz-share-field label,
.tz-share-field .style-label {
    display: block;
    margin-bottom: 8px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--share-muted);
}

.tz-share-field select,
.tz-share-field input[type="text"] {
    width: 100%;
    height: 42px;
    padding: 0 12px;
    border: 1px solid var(--share-line);
    border-radius: 10px;
    background: #fff;
    color: var(--share-ink);
    font: 500 13px Inter, sans-serif;
}

.tz-share-field select:focus,
.tz-share-field input[type="text"]:focus {
    outline: none;
    border-color: var(--share-accent);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.tz-share-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.tz-share-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: 44px;
    padding: 0 16px;
    border: 0;
    border-radius: 10px;
    font: 700 13px Inter, sans-serif;
    cursor: pointer;
    transition: background 0.15s ease, transform 0.1s ease;
}

.tz-share-btn:active {
    transform: scale(0.99);
}

.tz-share-btn--primary {
    background: var(--share-dark);
    color: #fff;
}

.tz-share-btn--primary:hover {
    background: #111827;
}

.tz-share-btn--accent {
    background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
    color: #fff;
}

.tz-share-btn--accent:hover {
    filter: brightness(1.05);
}

.tz-share-note {
    font-size: 11px;
    text-align: center;
    color: var(--share-muted);
    line-height: 1.45;
}

.tz-share-settings {
    background: var(--share-card);
    border: 1px solid var(--share-line);
    border-radius: 16px;
    padding: 18px;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.tz-share-settings__head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
}

.tz-share-settings__head i {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: #eff6ff;
    color: #2563eb;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.tz-share-settings__head h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 800;
}

.tz-share-settings__head p {
    margin: 2px 0 0;
    font-size: 12px;
    color: var(--share-muted);
}

.tz-share-save {
    margin-top: 10px;
    background: #f1f5f9;
    color: var(--share-ink);
    border: 1px solid var(--share-line);
}

.tz-share-save:hover {
    background: #e2e8f0;
}

.tz-share-alert {
    margin-top: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    background: #ecfdf5;
    border: 1px solid #bbf7d0;
    color: #047857;
    font-size: 12px;
    font-weight: 700;
    text-align: center;
}

.tz-share-empty {
    grid-column: 1 / -1;
    padding: 40px 20px;
    text-align: center;
    background: #fff;
    border: 1px dashed var(--share-line);
    border-radius: 16px;
    color: var(--share-muted);
}

@media (max-width: 768px) {
    .tz-share-topbar {
        padding: 12px 58px 12px 58px;
    }

    body:has(.admin-menu-btn) .tz-share-topbar {
        padding-left: 64px;
        padding-right: 58px;
    }

    body:has(.admin-menu-btn) .tz-share-topbar__brand {
        margin-left: 6px;
    }

    .admin-menu-btn {
        left: 10px !important;
    }

    .admin-share-btn {
        right: 10px !important;
    }

    .tz-share-topbar h1 {
        font-size: 16px;
    }

    .tz-share-wrap {
        padding: 0 12px 20px;
    }

    .tz-share-grid {
        grid-template-columns: 1fr;
        gap: 12px;
    }

    .tz-share-toolbar {
        flex-direction: column;
        align-items: stretch;
    }

    .tz-share-count {
        text-align: center;
    }
}
/* Tripanza Youth visual layer — presentation only. */
:root {
    --share-bg: #f6f7fc;
    --share-ink: #141824;
    --share-muted: #697386;
    --share-line: #dce3f2;
    --share-card: #ffffff;
    --share-accent: #3158dc;
    --share-dark: #141824;
    --share-lime: #d2ea59;
    --share-cream: #fbfaf5;
}

.tz-share-app {
    position: relative;
    overflow: hidden;
    background:
        radial-gradient(circle at 91% 8%, rgba(210, 234, 89, .25), transparent 20rem),
        radial-gradient(circle at 4% 45%, rgba(49, 88, 220, .07), transparent 24rem),
        var(--share-bg);
    padding-bottom: 72px;
}

.tz-share-topbar {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    width: 100%;
    min-height: 166px;
    margin: 0 0 28px;
    padding: 56px max(28px, calc((100vw - 1240px) / 2)) 30px;
    background: var(--share-accent);
    border: 0;
    border-radius: 0 0 34px 34px;
    box-shadow: 0 14px 35px rgba(49, 88, 220, .18);
}

.tz-share-topbar::before,
.tz-share-topbar::after {
    content: "";
    position: absolute;
    z-index: -1;
    border-radius: 50%;
    pointer-events: none;
}

.tz-share-topbar::before {
    width: 230px;
    height: 230px;
    right: 8%;
    top: -126px;
    border: 42px solid rgba(210, 234, 89, .24);
}

.tz-share-topbar::after {
    width: 118px;
    height: 118px;
    right: 30%;
    bottom: -83px;
    border: 24px solid rgba(255, 255, 255, .10);
}

.tz-share-topbar__brand { gap: 16px; }

.tz-share-topbar__icon {
    width: 58px;
    height: 58px;
    border-radius: 19px;
    background: var(--share-lime);
    color: var(--share-ink);
    box-shadow: 0 7px 0 rgba(20, 24, 36, .25);
    transform: rotate(-3deg);
    font-size: 21px;
}

.tz-share-topbar h1 {
    font-size: clamp(28px, 3vw, 42px);
    line-height: .98;
    letter-spacing: -.055em;
    font-weight: 800;
}

.tz-share-topbar p {
    margin-top: 8px;
    color: rgba(255, 255, 255, .82);
    font-size: 13px;
    font-weight: 600;
}

.tz-share-topbar__badge {
    height: 36px;
    padding: 0 15px;
    color: var(--share-ink);
    background: var(--share-lime);
    border: 1px solid rgba(20, 24, 36, .14);
    font-weight: 800;
    box-shadow: 0 4px 0 rgba(20, 24, 36, .18);
}

.tz-share-wrap {
    width: min(1280px, 100%);
    padding: 0 22px 30px;
}

.tz-share-toolbar {
    align-items: center;
    margin-bottom: 20px;
}

.tz-share-search input {
    height: 54px;
    padding-left: 46px;
    border: 1.5px solid var(--share-line);
    border-radius: 18px;
    background: rgba(255, 255, 255, .94);
    color: var(--share-ink);
    font-weight: 650;
    box-shadow: 0 10px 28px rgba(35, 49, 91, .06);
}

.tz-share-search i {
    left: 17px;
    color: var(--share-accent);
    font-size: 15px;
}

.tz-share-search input:focus,
.tz-share-field select:focus,
.tz-share-field input[type="text"]:focus {
    border-color: var(--share-accent);
    box-shadow: 0 0 0 4px rgba(49, 88, 220, .12);
}

.tz-share-count {
    padding: 9px 13px;
    border-radius: 999px;
    background: #e9edff;
    color: var(--share-accent);
    font-weight: 800;
}

.tz-share-count strong { color: var(--share-accent); }

.tz-share-grid {
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 20px;
    margin-bottom: 26px;
}

.tz-share-card {
    position: relative;
    overflow: hidden;
    gap: 16px;
    padding: 23px;
    border: 1.5px solid #d8e0ef;
    border-radius: 25px;
    box-shadow: 0 14px 38px rgba(40, 55, 94, .08);
}

.tz-share-card::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 6px;
    background: linear-gradient(90deg, var(--share-accent) 0 72%, var(--share-lime) 72% 100%);
}

.tz-share-card:hover {
    transform: translateY(-3px);
    border-color: rgba(49, 88, 220, .42);
    box-shadow: 0 18px 44px rgba(40, 55, 94, .13);
}

.tz-share-card__title {
    font-size: 20px;
    line-height: 1.2;
    letter-spacing: -.035em;
}

.tz-share-chip {
    height: 29px;
    padding: 0 11px;
    color: #3b4810;
    background: var(--share-lime);
    border: 1px solid rgba(77, 95, 13, .14);
    font-weight: 800;
}

.tz-share-meta-pill {
    padding: 7px 10px;
    border-color: #e1e6f1;
    border-radius: 10px;
    background: #f7f8fc;
    color: #596479;
}

.tz-share-meta-pill i { color: var(--share-accent); }

.tz-share-field label,
.tz-share-field .style-label {
    color: #4c5870;
    font-weight: 800;
}

.tz-share-field select,
.tz-share-field input[type="text"] {
    height: 50px;
    border: 1.5px solid var(--share-line);
    border-radius: 15px;
    background: #fbfcff;
    color: var(--share-ink);
    font-weight: 650;
}

.tz-share-btn {
    min-height: 50px;
    border-radius: 15px;
    font-weight: 800;
}

.tz-share-btn--primary {
    background: var(--share-accent);
    color: #fff;
    box-shadow: 0 5px 0 #1738a2;
}

.tz-share-btn--primary:hover { background: #264bd0; }

.tz-share-btn--accent {
    background: var(--share-lime);
    color: var(--share-ink);
    box-shadow: 0 5px 0 #9fb633;
}

.tz-share-btn--accent:hover {
    filter: none;
    background: #dcf26b;
}

.tz-share-btn:active {
    transform: translateY(3px);
    box-shadow: 0 2px 0 rgba(20, 24, 36, .28);
}

.tz-share-note { color: #7a8496; }

.tz-share-settings {
    padding: 24px;
    border: 1.5px solid #d8e0ef;
    border-radius: 25px;
    background:
        radial-gradient(circle at 95% 10%, rgba(210, 234, 89, .34), transparent 12rem),
        #fff;
    box-shadow: 0 14px 38px rgba(40, 55, 94, .08);
}

.tz-share-settings__head i {
    width: 44px;
    height: 44px;
    border-radius: 14px;
    background: #e8edff;
    color: var(--share-accent);
}

.tz-share-settings__head h2 {
    font-size: 19px;
    letter-spacing: -.025em;
}

.tz-share-save {
    background: var(--share-ink);
    border: 0;
    color: #fff;
}

@media (max-width: 768px) {
    .tz-share-app { padding-bottom: 42px; }

    .tz-share-topbar,
    body:has(.admin-menu-btn) .tz-share-topbar {
        min-height: 176px;
        padding: 70px 18px 24px 66px;
        margin-bottom: 20px;
        border-radius: 0 0 28px 28px;
    }

    .tz-share-topbar__brand { gap: 12px; }
    .tz-share-topbar__icon { width: 50px; height: 50px; border-radius: 16px; }
    .tz-share-topbar h1 { font-size: 27px; }
    .tz-share-topbar p { max-width: 230px; font-size: 11px; }
    .tz-share-topbar__badge { position: absolute; right: 16px; top: 17px; height: 31px; }
    .tz-share-wrap { padding: 0 13px 22px; }
    .tz-share-grid { grid-template-columns: minmax(0, 1fr); gap: 14px; }
    .tz-share-card { padding: 20px; border-radius: 22px; }
    .tz-share-card:hover { transform: none; }
    .tz-share-toolbar { gap: 9px; }
    .tz-share-count { align-self: center; }
    .tz-share-settings { padding: 20px; border-radius: 22px; }
}
</style>

<div class="tz-share-app">
    <header class="tz-share-topbar">
        <div class="tz-share-topbar__brand">
            <span class="tz-share-topbar__icon"><i class="fa-solid fa-wand-magic-sparkles"></i></span>
            <div>
                <h1>AI Poster Generator</h1>
                <p>Create share-ready prompts for your trips</p>
            </div>
        </div>
        <span class="tz-share-topbar__badge"><?php echo esc_html( (string) $tours->post_count ); ?> trips</span>
    </header>

    <div class="tz-share-wrap">
        <div class="tz-share-toolbar">
            <div class="tz-share-search">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input type="text" id="tripSearchFilter" onkeyup="filterMyTrips()" placeholder="Search trips by name...">
            </div>
            <div class="tz-share-count"><strong id="tzShareVisibleCount"><?php echo esc_html( (string) $tours->post_count ); ?></strong> visible</div>
        </div>

        <div class="tz-share-grid" id="tzShareGrid">

<?php 
while($tours->have_posts()): $tours->the_post();

$post_id = get_the_ID();
$title = get_the_title($post_id);
$inventory_post_id = function_exists('tripanza_get_inventory_trip_id') ? tripanza_get_inventory_trip_id($post_id) : $post_id;
$host_allowed_dates = ($inventory_post_id !== $post_id && function_exists('tripanza_get_host_selected_dates')) ? tripanza_get_host_selected_dates($post_id) : array();

/* st_tours duration can be numeric or values such as 3N/4D. */
$duration_data = tz_share_parse_duration(get_post_meta($post_id, 'duration_day', true));
$duration_days = $duration_data['days'];
$trip_nights = $duration_data['nights'];
$duration_label = $duration_data['label'];
$duration_stats = $duration_days > 0
    ? sprintf('%02d Days | %02d Nights', $duration_days, $trip_nights)
    : $duration_label;
$duration_ticket = $duration_days > 0
    ? sprintf('%dD-%dN', $duration_days, $trip_nights)
    : $duration_label;
$duration_wanderon = $duration_days > 0
    ? sprintf('%dN - %dD', $trip_nights, $duration_days)
    : $duration_label;

/* Merge the two st_tours availability sources and keep real future dates only. */
global $wpdb;
$table = $wpdb->prefix . 'st_tour_availability';
$today_ts = (new DateTimeImmutable('today', wp_timezone()))->getTimestamp();
$rows = $wpdb->get_results(
    $wpdb->prepare("SELECT check_in FROM $table WHERE post_id = %d AND status = 'available'", $inventory_post_id)
);
$future_dates = array();
foreach ((array) $rows as $row) {
    $timestamp = tz_share_parse_date($row->check_in);
    if ($inventory_post_id !== $post_id && !in_array(wp_date('Y-m-d', $timestamp), $host_allowed_dates, true)) continue;
    if ($timestamp >= $today_ts) {
        $future_dates[$timestamp] = $timestamp;
    }
}

$seats_data = get_post_meta($post_id, '_seats_availability', true);
foreach (is_array($seats_data) ? $seats_data : array() as $check_in => $seats) {
    $timestamp = tz_share_parse_date($check_in);
    if ($timestamp < $today_ts) {
        continue;
    }
    if ($inventory_post_id !== $post_id && !in_array(wp_date('Y-m-d', $timestamp), $host_allowed_dates, true)) continue;
    if (is_numeric($seats) && (float) $seats <= 0) {
        unset($future_dates[$timestamp]);
    } else {
        $future_dates[$timestamp] = $timestamp;
    }
}
sort($future_dates, SORT_NUMERIC);

$formatted_date = '';
$end_date = '';
if (!empty($future_dates)) {
    $formatted_date = wp_date('j M Y', $future_dates[0], wp_timezone());
    if ($duration_days > 1) {
        $end_date = wp_date(
            'j M Y',
            strtotime('+' . ($duration_days - 1) . ' days', $future_dates[0]),
            wp_timezone()
        );
    }
}
$available_dates = array_map(static function ($timestamp) {
    return wp_date('j M Y', $timestamp, wp_timezone());
}, array_slice($future_dates, 0, 5));
$availability_text = implode(', ', $available_dates);

/* Use only a saved, currently active offer. */
$tour_timer = trim((string) get_post_meta($post_id, '_st_tour_timer', true));
$tour_note = trim(wp_strip_all_tags((string) get_post_meta($post_id, '_st_tour_timer_note', true)));
$cashback_pp = (float) get_post_meta($post_id, 'tripanza_cashback_pp', true);
$timer_ts = tz_share_parse_date($tour_timer);
$offer_is_active = $tour_timer === '' || $timer_ts > time();
$display_note = '';
if ($offer_is_active && $tour_note !== '') {
    $display_note = $tour_note;
} elseif ($offer_is_active && $cashback_pp > 0) {
    $display_note = '₹' . number_format_i18n($cashback_pp) . ' cashback per person';
}
$timer_text = ($display_note !== '' && $timer_ts > time())
    ? 'Offer valid till ' . wp_date('j M Y, g:i A', $timer_ts, wp_timezone())
    : '';

/* Host details */
$host_id = get_post_field('post_author', $post_id);
$host_phone = trim((string) get_user_meta($host_id, 'st_phone', true));
$company_name = trim((string) get_user_meta($host_id, 'travel_company', true));
$company_name = $company_name ?: get_the_author_meta('display_name', $host_id);
$logo_id = get_user_meta($host_id, 'company_logo', true);
$logo_url = $logo_id ? wp_get_attachment_url($logo_id) : '';

/* Resolve one positive adult price even when the helper returns sale-price markup. */
$price_amount = 0;
$price_html = function_exists('get_tour_price') ? (string) get_tour_price($inventory_post_id, 'adult') : '';
$price_text = wp_strip_all_tags($price_html);
preg_match_all('/\d+(?:,\d{3})*(?:\.\d+)?/', $price_text, $price_matches);
$parsed_prices = array_filter(array_map(static function ($value) {
    return (float) str_replace(',', '', $value);
}, $price_matches[0] ?? array()));
if (!empty($parsed_prices)) {
    $price_amount = min($parsed_prices);
}
if ($price_amount <= 0) {
    foreach (array('adult_price', 'min_price', 'base_price', 'price') as $price_key) {
        $raw_price = str_replace(',', '', (string) get_post_meta($post_id, $price_key, true));
        if (is_numeric($raw_price) && (float) $raw_price > 0) {
            $price_amount = (float) $raw_price;
            break;
        }
    }
}
/* A host poster must advertise the actual storefront fare, not the lower
 * canonical fare that omits that host's approved per-person markup. */
if ($price_amount > 0 && $inventory_post_id !== $post_id && !empty($future_dates) && function_exists('tripanza_get_host_departure_markup')) {
    $price_amount += tripanza_get_host_departure_markup($post_id, $future_dates[0]);
}
$adult_price = $price_amount > 0
    ? '₹' . number_format_i18n($price_amount, floor($price_amount) == $price_amount ? 0 : 2)
    : 'Price on request';
$price_detail = $price_amount > 0 ? 'Starting from ' . $adult_price . ' per person' : $adult_price;

/* Existing destination/visual prompt logic */
$visual_prompt = trim((string) get_post_meta($post_id, 'tripanza_visual_prompt', true));
$visual_text = '';
foreach (preg_split('/[\r\n]+/', $visual_prompt) as $line) {
    if (trim($line) !== '') {
        $visual_text .= '- ' . trim($line) . "\n";
    }
}
$departure_ts = !empty($future_dates) ? $future_dates[0] : null;
$dest_profile = tz_build_destination_profile($post_id, $title, $departure_ts);
$display_location = $dest_profile['location'];
$destination_block = tz_format_destination_block($dest_profile, $visual_text);
$location_upper = strtoupper($display_location);

$location_stack_parts = preg_split('/\s*(?:,|&|\+|\/|\band\b)\s*/i', $display_location);
$location_stack_parts = array_values(array_filter(array_map('trim', $location_stack_parts)));
if (count($location_stack_parts) <= 1) {
    $location_stack_parts = array($display_location);
}
$location_stack = implode("\n", array_map('strtoupper', array_slice($location_stack_parts, 0, 4)));

/* Package prompts use only inclusions saved on this st_tours post. */
$raw_inclusions = (string) get_post_meta($post_id, 'tours_include', true);
$custom_inclusions = (string) get_post_meta($post_id, '_custom_tour_inclusions', true);
if (trim($custom_inclusions) !== '') {
    $raw_inclusions .= "\n" . $custom_inclusions;
}
$saved_inclusions = tz_share_saved_inclusions(
    $raw_inclusions,
    (string) get_post_meta($post_id, 'tours_exclude', true)
);
$package_night_scene = tz_format_package_night_scene($dest_profile);
$package_inclusions_block = tz_format_package_inclusions($saved_inclusions);


$prompt_cinematic = "Create a HIGH-CONVERTING Instagram story poster for youths.

Trip Details:
- Destination: {$display_location}
- Trip name: {$title}
- Duration: {$duration_label}
- Dates: {$formatted_date}" . ($end_date ? " to {$end_date}" : "") . "
- Upcoming Departures: {$availability_text}
- Hosted by: {$company_name}
- Contact: {$host_phone}
- Price: {$price_detail}

Offer & Urgency:
- {$display_note}
" . ($timer_text ? "- {$timer_text}\n" : "") . "
{$destination_block}

Creative Direction:
- Cinematic, premium, Gen-Z aesthetic
- 9:16 Instagram story format
- Strong FOMO + urgency

Visual direction:
Follow DESTINATION PROFILE above (palette, anchors, mood, host notes).

Text Layout:
- Hook: \"{$pov}\"
- Title: \"{$title}\"
- Dates: \"{$formatted_date}" . ($end_date ? " - {$end_date}" : "") . "\"
- Availability: \"{$availability_text}\"
- Offer: \"{$display_note}\"
- Price Highlight: \"{$adult_price}\"
- CTA: \"DM / WhatsApp to book now\"

FOOTER RULE:
- Add small subtle text at bottom:
  \"Powered by www.tripanza.com\"

Important:
- Make it viral
- Avoid generic posters
- Do NOT add any brand name or logo
- Only show host name (Hosted by {$company_name} and Contact: {$host_phone})";




$prompt_clean = "Create a HIGH-CONVERTING, GRAPHIC-DESIGN STYLE Instagram poster (NOT realistic photo style).

Trip Details:
- Destination: {$display_location}
- Trip name: {$title}
- Duration: {$duration_label}
- Dates: {$formatted_date}" . ($end_date ? " to {$end_date}" : "") . "
- Upcoming Departures: {$availability_text}
- Hosted by: {$company_name}
- Contact: {$host_phone}
- Price: {$price_detail}

Offer:
- {$display_note}

{$destination_block}

DESIGN STYLE (VERY IMPORTANT):
- Premium, modern youth travel poster
- Bold typography but clean layout
- Minimal but impactful design
- Avoid clutter and excessive elements

COLOR SYSTEM (STRICT):
- Use ONLY 2 or maximum 3 colors in entire design
- Base: dark or neutral background (black, deep purple, dark blue)
- Accent: 1 primary highlight color (yellow OR neon pink OR orange)
- Optional: 1 secondary subtle tone
- Maintain strong color consistency across poster

DO NOT:
- Use random multiple colors
- Avoid rainbow/neon mix
- Avoid cheap “template” look

VISUAL STYLE:
Follow DESTINATION PROFILE above (palette, anchors, mood, host notes).

IMAGE STYLE:
- High-quality cinematic group photo
- Clean cutout or blended overlay
- No messy collage

LAYOUT STYLE:
- Strong hierarchy (Title → Price → CTA)
- Large bold title
- Clean spacing and alignment
- Use boxes/cards sparingly

TEXT ELEMENTS:
- Title: very bold, premium font style
- Price: highlighted clean block
- Dates: subtle but readable
- Hosted by: small clean text

DESIGN ELEMENTS:
- Minimal shapes (no clutter)
- Soft gradients or single-tone background
- Subtle glow or shadow (not heavy effects)

FOOTER:
- \"Powered by www.tripanza.com\" (very subtle)

FINAL LOOK:
- Premium
- Clean
- Youthful but not loud
- Instagram brand-level quality";

	
	$prompt_vibrant = "Create a HIGH-CONVERTING, GRAPHIC-DESIGN STYLE Instagram poster (NOT realistic photo style).

Trip Details:
- Destination: {$display_location}
- Trip name: {$title}
- Duration: {$duration_label}
- Dates: {$formatted_date}" . ($end_date ? " to {$end_date}" : "") . "
- Upcoming Departures: {$availability_text}
- Hosted by: {$company_name}
- Contact: {$host_phone}
- Price: {$price_detail}

Offer:
- {$display_note}

{$destination_block}

DESIGN STYLE (VERY IMPORTANT):
- Bold, high-energy youth poster
- Big typography (title dominates layout)
- Sticker-style text blocks
- Layered composition (NOT minimal)
- Clean but impactful layout

COLOR SYSTEM (STRICT – VERY IMPORTANT):
- Use ONLY 2–3 primary colors (max 4 including accent)
- Define clearly:
  • 1 Background color
  • 1 Primary highlight color
  • 1 Accent color (optional)
  • 1 Neutral (white/black)
- Avoid gradients with multiple hues
- Keep strong contrast (dark vs bright)
- Maintain color consistency across all elements

IMAGE STYLE:
- Group of young people (friends, fun, expressive)
- Cutout style (subjects separated from background)
- Collage composition (2–4 elements max, not cluttered)

TEXT LAYOUT (VERY IMPORTANT):
- BIG TITLE (top or center, bold & dominant)
- Key info in sticker boxes
- Dates inside solid block
- Price large & bold (₹ emphasized)
- Hosted by smaller but visible
- CTA: \"DM / WhatsApp to Join\"

DESIGN ELEMENTS:
- Rounded sticker boxes (use same color palette)
- Minimal abstract shapes (limit quantity)
- Hand-drawn arrows / scribbles (single accent color only)
- Light grid/texture (low opacity, subtle)

FOOTER:
- \"Powered by www.tripanza.com\" (small and subtle)

STRICT RULES:
- Do NOT add any brand name or logo
- Only show host name
- Avoid multicolor chaos
- Avoid realistic photography poster style
- Maintain clean color hierarchy

OUTPUT STYLE:
- Youthful
- Premium + clean
- Scroll-stopping but not cluttered";


$prompt_doodle = "Create a HIGH-CONVERTING, GRAPHIC-DESIGN STYLE Instagram poster (NOT realistic photo style).

Trip Details:
- Destination: {$display_location}
- Trip name: {$title}
- Duration: {$duration_label}
- Dates: {$formatted_date}" . ($end_date ? " to {$end_date}" : "") . "
- Upcoming Departures: {$availability_text}
- Hosted by: {$company_name}
- Contact: {$host_phone}
- Price: {$price_detail}

Offer:
- {$display_note}

{$destination_block}

DESIGN STYLE (VERY IMPORTANT):
- Premium illustrative / vector poster (NOT realistic photography)
- Use flat illustrations or semi-3D vector characters
- Modern startup-style design (clean but playful)
- Slight doodle / hand-drawn accents allowed

COLOR SYSTEM (STRICT):
- Use ONLY 2–3 colors max
- Base: soft gradient or muted background
- Accent: 1 strong highlight color (yellow OR pink OR orange)
- Keep palette consistent (no random colors)

VISUAL STYLE:
Follow DESTINATION PROFILE above (palette, anchors, mood, host notes).

ILLUSTRATION STYLE:
- Young travelers illustrated (not real photos)
- Vector characters / silhouettes / stylized figures
- Simple facial expressions, fun poses
- Optional: minimal scene elements (mountains, beach, bus, etc.)
- Avoid hyper-detailed artwork

LAYOUT STYLE:
- Bold typography focus
- Clean spacing and hierarchy
- Title should dominate
- Supporting info in neat blocks/cards

DOODLE ELEMENTS:
- Arrows, scribbles, underlines
- Small icons (bus, camera, mountains, party)
- Hand-drawn accents (very minimal, not messy)

TEXT ELEMENTS:
- Title: bold, modern, slightly playful font
- Price: highlighted clean block
- Dates: subtle but clear
- Hosted by: small clean text

DESIGN ELEMENTS:
- Soft shadows or glow
- Rounded shapes or cards
- Minimal layering (not cluttered)

FOOTER:
- \"Powered by www.tripanza.com\" (small and subtle)

STRICT RULES:
- Do NOT use real photos
- Do NOT create photorealistic humans
- Do NOT use too many colors
- Avoid clutter and chaos

FINAL LOOK:
- Clean + playful
- Premium startup aesthetic
- Youthful but controlled
- Instagram ad quality";


$prompt_tropical = "Create a HIGH-CONVERTING Instagram poster in a modern graphic design style (NOT realistic photo style).

Trip Details:
- Destination: {$display_location}
- Trip name: {$title}
- Duration: {$duration_label}
- Dates: {$formatted_date}" . ($end_date ? " to {$end_date}" : "") . "
- Upcoming Departure: {$availability_text}
- Hosted by: {$company_name}
- Contact: {$host_phone}
- Price: {$price_detail}

Offer:
- {$display_note}

{$destination_block}

Design Direction:

- Style: Clean + Youthful + Energetic with subtle doodle elements
- Theme: Travel, freedom, youth trip vibe, fun & safe
- Color Palette: Use Palette lock from DESTINATION PROFILE (max 3–4 colors, strong consistency)
- Background: Minimal with abstract shapes, waves, and travel doodles
- Layout: Bold, scroll-stopping hierarchy with strong contrast

Typography:

- Headline: Big, bold, modern sans-serif
- Subtext: Clean and minimal
- Highlight price & offer using sticker/badge style

Main Visual Elements:

- Illustrated silhouettes of young travelers enjoying {$display_location}
- Doodle overlays (sparkles, arrows, waves, motion lines)

Conversion Boosters:

- Add urgency badge: \"Limited Seats\"
- Add trust element: \"Safe & Verified Trip\"
- CTA: \"DM / WhatsApp to Join\"

STRICT RULES:

- Do NOT use realistic photography
- Keep layout clean and uncluttered
- Maintain strong spacing & alignment
- Ensure mobile-first readability
- Use max 3–4 colors only

FOOTER:
- \"Powered by www.tripanza.com\" (subtle)

OUTPUT:

- Instagram Story format (9:16)
- Scroll-stopping, high-converting design";

$prompt_luxury = "Create a HIGH-CONVERTING Instagram poster in a modern AESTHETIC / SOFT-LUXURY EDITORIAL style (NOT realistic travel collage style).

Trip Details:
- Destination: {$display_location}
- Trip name: {$title}
- Duration: {$duration_label}
- Dates: {$formatted_date}" . ($end_date ? " to {$end_date}" : "") . "
- Upcoming Departures: {$availability_text}
- Hosted by: {$company_name}
- Contact: {$host_phone}
- Price: {$price_detail}

Offer:
- {$display_note}

{$destination_block}

DESIGN STYLE (VERY IMPORTANT)

- Soft aesthetic, Pinterest-inspired, calm luxury feel
- Editorial + lifestyle + moodboard fusion (NOT bold fashion ad)
- Feminine, dreamy, slightly romantic travel vibe
- Minimal but emotion-driven (not product-focused)
- Clean but NOT corporate or aggressive

COLOR SYSTEM

- Soft neutral palette: off-white, cream, beige, warm grey
- Subtle pastel accents (sage green / muted ocean blue / sand tones)
- Very low contrast, smooth gradients allowed
- Avoid pure black → use soft charcoal tones

VISUAL STYLE (VERY IMPORTANT)

- ONE aesthetic hero setup (travel-driven, NOT product-driven):
  • A candid moment of young travelers (girls / friends) in a calm scenic setting (beach, mountains, café, balcony view)
  • OR a soft lifestyle travel moment (sitting by window, holding coffee, looking at view, walking by shore)
  • OR minimal travel scene with human presence (feet in sand, suitcase beside beach, girl looking at sunset)

- Scene should feel:
  • Real, relatable, “I want to be there”
  • Calm, dreamy, slightly romantic
  • Natural and effortless (NOT posed like product shoot)

- Composition:
  • Subject slightly off-center (editorial framing)
  • Background softly blurred or minimal
  • Airy spacing, lots of negative space

- Lighting:
  • Natural light (golden hour / soft daylight)
  • Soft shadows, warm tones

Optional subtle elements:
- Palm leaf shadows
- Ocean breeze fabric movement
- Sunlight streaks
- Linen / texture overlays
- Soft grain / film effect

IMPORTANT:
- Focus on emotion + experience, not objects
- Viewer should imagine themselves in the moment

Optional subtle elements:
- Palm leaf shadows
- Sunlight streaks
- Linen / fabric textures
- Soft grain / film effect

LAYOUT STYLE

- Asymmetrical editorial layout (NOT grid-based)
- Lots of breathing space (whitespace is key)
- Text softly placed, not in heavy blocks
- Slight overlap of elements for editorial feel

TYPOGRAPHY

- Elegant serif (for headings)
- Clean minimal sans-serif (for details)
- Thin, spaced-out typography
- Avoid bold/heavy fonts

TEXT STRUCTURE

- Top Hook (small & subtle):
  Pick ONE from Suggested headlines in DESTINATION PROFILE

- Main Title:
  \"{$title}\"

- Subtitle:
  Include only if not already part of title

- Price:
  \"{$adult_price}\"

- Offer:
  \"{$display_note}\"

- Dates:
  \"{$availability_text}\"

- CTA:
  \"DM TO JOIN\"

DESIGN ELEMENTS

- Thin lines / soft dividers
- Minimal label-style tags
- Subtle underline accents

Optional:
- Paper texture overlay
- Soft shadows
- Grain effect

STRICT RULES

- No clutter, no crowded layout
- No bright or neon colors
- No stickers, badges, or loud banners
- No collage or multiple images
- Avoid aggressive \"SALE\" look
- Maintain calm, premium aesthetic

FOOTER

- \"Powered by www.tripanza.com\" (very subtle)

FINAL LOOK

- Aesthetic + dreamy + feminine
- Soft luxury travel vibe
- Pinterest-worthy
- Calm but scroll-stopping
- Premium yet relatable

OUTPUT

- Instagram Story format (9:16)
- Aesthetic editorial poster
- Clean, soft, high-conversion design";


$prompt_editorial = "Create a HIGH-CONVERTING Instagram poster in a modern EDITORIAL / FASHION AD style (NOT realistic travel collage style).

Trip Details:
- Destination: {$display_location}
- Trip name: {$title}
- Duration: {$duration_label}
- Dates: {$formatted_date}" . ($end_date ? " to {$end_date}" : "") . "
- Upcoming Departures: {$availability_text}
- Hosted by: {$company_name}
- Contact: {$host_phone}
- Price: {$price_detail}

Offer:
- {$display_note}

{$destination_block}

DESIGN STYLE (VERY IMPORTANT):

- Clean, editorial, fashion-brand style layout (like Zara / H&M ads)
- Minimal, premium, product-focused composition
- Strong focus on ONE main visual (not multiple elements)
- No clutter, no heavy graphics

COLOR SYSTEM:

- Neutral tones (white, beige, grey, black)
- Optional 1 subtle accent color based on destination
- Keep palette very limited and balanced

VISUAL STYLE:

- Single hero visual (travel-focused, NOT product display):
  • Young traveler or small group in a strong pose (walking, standing, exploring)
  • OR action-based moment (trekking, beach walk, bike ride, café sitting, viewpoint pose)
  • OR destination highlight with human scale (person looking at mountains, sea, city)

- Scene should feel:
  • Aspirational but real
  • Confident, bold, youth-driven
  • Like a campaign shot for a travel brand

- Composition:
  • Clean background (minimal distractions)
  • Subject clearly defined (center or strong frame)
  • Slight editorial crop (not full wide scenic clutter)

- Styling:
  • Trendy travel outfits (jackets, sunglasses, backpacks)
  • Natural movement (walking, turning, candid laugh)

- Background:
  • Destination-relevant (mountains, beach, street, café, desert, snow)
  • Keep it clean and non-busy

IMPORTANT:
- Treat the HUMAN + EXPERIENCE as the “product”
- No isolated objects like bags/suitcases as main focus
- No collage, no multiple scenes

LAYOUT STYLE:

- Large bold headline at top (e.g. \"BESTSELLER\" / \"TRENDING TRIP\")
- Strong central composition (object-focused)
- Plenty of whitespace
- Small supporting text blocks

TYPOGRAPHY:

- Big bold sans-serif headline (clean & premium)
- Small minimal description text
- Price shown in a neat tag/block
- CTA simple button style (\"Book Now\")

TEXT STRUCTURE:

- Top Hook: Pick ONE from Suggested headlines in DESTINATION PROFILE
- Title: \"{$title}\"
- Price: \"{$adult_price}\"
- Dates: subtle placement
- CTA: \"Book Now\" or \"DM to Join\"

DESIGN ELEMENTS:

- Optional barcode / label / tag style elements
- Minimal lines or separators
- Clean product-tag style price badge

STRICT RULES:

- Do NOT use collage or multiple busy visuals
- Do NOT use doodles or stickers
- Do NOT overcrowd layout
- Keep everything aligned and balanced

FOOTER:

- \"Powered by www.tripanza.com\" (very subtle)

FINAL LOOK:

- Premium
- Minimal
- Fashion-brand inspired
- Clean & aspirational
- Scroll-stopping in a subtle way

OUTPUT:

- Instagram Story format (9:16)
- Editorial, product-ad style poster";



$prompt_editorialold = "Create a HIGH-CONVERTING Instagram poster in a modern EDITORIAL / FASHION AD style (NOT realistic travel collage style).

Trip Details:
- Destination: {$display_location}
- Trip name: {$title}
- Duration: {$duration_label}
- Dates: {$formatted_date}" . ($end_date ? " to {$end_date}" : "") . "
- Upcoming Departures: {$availability_text}
- Hosted by: {$company_name}
- Contact: {$host_phone}
- Price: {$price_detail}

Offer:
- {$display_note}

{$destination_block}

DESIGN STYLE (VERY IMPORTANT):

- Clean, editorial, fashion-brand style layout (like Zara / H&M ads)
- Minimal, premium, product-focused composition
- Strong focus on ONE main visual (not multiple elements)
- No clutter, no heavy graphics

COLOR SYSTEM:

- Neutral tones (white, beige, grey, black)
- Optional 1 subtle accent color based on destination
- Keep palette very limited and balanced

VISUAL STYLE:

- Single hero visual:
  • Travel outfit / backpack / suitcase / lifestyle setup
  • OR stylized travel scene arranged like a product shoot
- Clean background (studio-style or minimal environment)
- Objects arranged aesthetically (not random)

LAYOUT STYLE:

- Large bold headline at top (e.g. \"BESTSELLER\" / \"TRENDING TRIP\")
- Strong central composition (object-focused)
- Plenty of whitespace
- Small supporting text blocks

TYPOGRAPHY:

- Big bold sans-serif headline (clean & premium)
- Small minimal description text
- Price shown in a neat tag/block
- CTA simple button style (\"Book Now\")

TEXT STRUCTURE:

- Top Hook: Pick ONE from Suggested headlines in DESTINATION PROFILE
- Title: \"{$title}\"
- Price: \"{$adult_price}\"
- Dates: subtle placement
- CTA: \"Book Now\" or \"DM to Join\"

DESIGN ELEMENTS:

- Optional barcode / label / tag style elements
- Minimal lines or separators
- Clean product-tag style price badge

STRICT RULES:

- Do NOT use collage or multiple busy visuals
- Do NOT use doodles or stickers
- Do NOT overcrowd layout
- Keep everything aligned and balanced

FOOTER:

- \"Powered by www.tripanza.com\" (very subtle)

FINAL LOOK:

- Premium
- Minimal
- Fashion-brand inspired
- Clean & aspirational
- Scroll-stopping in a subtle way

OUTPUT:

- Instagram Story format (9:16)
- Editorial, product-ad style poster";


$prompt_editorialtravelold = "Create a HIGH-CONVERTING Instagram poster in a modern EDITORIAL / FASHION AD style (NOT realistic travel collage style).

Trip Details:
- Destination: {$title}
- Duration: {$duration_label}
- Dates: {$formatted_date}" . ($end_date ? " to {$end_date}" : "") . "
- Upcoming Departures: {$availability_text}
- Hosted by: {$company_name}
- Contact: {$host_phone}
- Price: {$price_detail}

Offer:
- {$display_note}

DESIGN STYLE (VERY IMPORTANT):

- Clean, editorial, fashion-brand style layout (like Zara / H&M ads)
- Minimal, premium, product-focused composition
- Strong focus on ONE main visual (not multiple elements)
- No clutter, no heavy graphics

COLOR SYSTEM:

- Neutral tones (white, beige, grey, black)
- Optional 1 subtle accent color based on destination
- Keep palette very limited and balanced

VISUAL STYLE:

- Single hero visual (travel-focused, NOT product display):
  • Young traveler or small group in a strong pose (walking, standing, exploring)
  • OR action-based moment (trekking, beach walk, bike ride, café sitting, viewpoint pose)
  • OR destination highlight with human scale (person looking at mountains, sea, city)

- Scene should feel:
  • Aspirational but real
  • Confident, bold, youth-driven
  • Like a campaign shot for a travel brand

- Composition:
  • Clean background (minimal distractions)
  • Subject clearly defined (center or strong frame)
  • Slight editorial crop (not full wide scenic clutter)

- Styling:
  • Trendy travel outfits (jackets, sunglasses, backpacks)
  • Natural movement (walking, turning, candid laugh)

- Background:
  • Destination-relevant (mountains, beach, street, café, desert, snow)
  • Keep it clean and non-busy

IMPORTANT:
- Treat the HUMAN + EXPERIENCE as the \"product\"
- No isolated objects like bags/suitcases as main focus
- No collage, no multiple scenes

LAYOUT STYLE:

- Large bold headline at top (e.g. \"BESTSELLER\" / \"TRENDING TRIP\")
- Strong central composition (object-focused)
- Plenty of whitespace
- Small supporting text blocks

TYPOGRAPHY:

- Big bold sans-serif headline (clean & premium)
- Small minimal description text
- Price shown in a neat tag/block
- CTA simple button style (\"Book Now\")

TEXT STRUCTURE:

- Top Hook: \"MOST BOOKED TRIP\" or \"TRENDING NOW\"
- Title: \"{$title}\"
- Price: \"{$adult_price}\"
- Dates: subtle placement
- CTA: \"Book Now\" or \"DM to Join\"

DESIGN ELEMENTS:

- Optional barcode / label / tag style elements
- Minimal lines or separators
- Clean product-tag style price badge

STRICT RULES:

- Do NOT use collage or multiple busy visuals
- Do NOT use doodles or stickers
- Do NOT overcrowd layout
- Keep everything aligned and balanced

FOOTER:

- \"Powered by www.tripanza.com\" (very subtle)

FINAL LOOK:

- Premium
- Minimal
- Fashion-brand inspired
- Clean & aspirational
- Scroll-stopping in a subtle way

OUTPUT:

- Instagram Story format (9:16)
- Editorial, product-ad style poster";


$prompt_editorialproductold = "Create a HIGH-CONVERTING Instagram poster in a modern EDITORIAL / FASHION AD style (NOT realistic travel collage style).

Trip Details:
- Destination: {$title}
- Duration: {$duration_label}
- Dates: {$formatted_date}" . ($end_date ? " to {$end_date}" : "") . "
- Upcoming Departures: {$availability_text}
- Hosted by: {$company_name}
- Contact: {$host_phone}
- Price: {$price_detail}

Offer:
- {$display_note}

DESIGN STYLE (VERY IMPORTANT):

- Clean, editorial, fashion-brand style layout (like Zara / H&M ads)
- Minimal, premium, product-focused composition
- Strong focus on ONE main visual (not multiple elements)
- No clutter, no heavy graphics

COLOR SYSTEM:

- Neutral tones (white, beige, grey, black)
- Optional 1 subtle accent color based on destination
- Keep palette very limited and balanced

VISUAL STYLE:

- Single hero visual:
  • Travel outfit / backpack / suitcase / lifestyle setup
  • OR stylized travel scene arranged like a product shoot
- Clean background (studio-style or minimal environment)
- Objects arranged aesthetically (not random)

LAYOUT STYLE:

- Large bold headline at top (e.g. \"BESTSELLER\" / \"TRENDING TRIP\")
- Strong central composition (object-focused)
- Plenty of whitespace
- Small supporting text blocks

TYPOGRAPHY:

- Big bold sans-serif headline (clean & premium)
- Small minimal description text
- Price shown in a neat tag/block
- CTA simple button style (\"Book Now\")

TEXT STRUCTURE:

- Top Hook: \"MOST BOOKED TRIP\" or \"TRENDING NOW\"
- Title: \"{$title}\"
- Price: \"{$adult_price}\"
- Dates: subtle placement
- CTA: \"Book Now\" or \"DM to Join\"

DESIGN ELEMENTS:

- Optional barcode / label / tag style elements
- Minimal lines or separators
- Clean product-tag style price badge

STRICT RULES:

- Do NOT use collage or multiple busy visuals
- Do NOT use doodles or stickers
- Do NOT overcrowd layout
- Keep everything aligned and balanced

FOOTER:

- \"Powered by www.tripanza.com\" (very subtle)

FINAL LOOK:

- Premium
- Minimal
- Fashion-brand inspired
- Clean & aspirational
- Scroll-stopping in a subtle way

OUTPUT:

- Instagram Story format (9:16)
- Editorial, product-ad style poster";

$prompt_luxuryproduct = "Create a HIGH-CONVERTING Instagram poster in a modern AESTHETIC / SOFT-LUXURY EDITORIAL style (NOT realistic travel collage style).

Trip Details:
- Destination: {$display_location}
- Trip name: {$title}
- Duration: {$duration_label}
- Dates: {$formatted_date}" . ($end_date ? " to {$end_date}" : "") . "
- Upcoming Departures: {$availability_text}
- Hosted by: {$company_name}
- Contact: {$host_phone}
- Price: {$price_detail}

Offer:
- {$display_note}

{$destination_block}

DESIGN STYLE (VERY IMPORTANT)

- Soft aesthetic, Pinterest-inspired, calm luxury feel
- Editorial + lifestyle + moodboard fusion (NOT bold fashion ad)
- Feminine, dreamy, slightly romantic travel vibe
- Minimal but emotion-driven (not product-focused)
- Clean but NOT corporate or aggressive

COLOR SYSTEM

- Soft neutral palette: off-white, cream, beige, warm grey
- Subtle pastel accents (sage green / muted ocean blue / sand tones)
- Very low contrast, smooth gradients allowed
- Avoid pure black → use soft charcoal tones

VISUAL STYLE (VERY IMPORTANT)

- ONE aesthetic hero setup:
  • Styled suitcase + outfit + accessories
  • OR beach-inspired minimal setup (scarf, tote, sunglasses, linen fabric)
- Slightly candid / lived-in feel (NOT stiff product placement)
- Natural light, soft shadows, airy composition

Optional subtle elements:
- Palm leaf shadows
- Sunlight streaks
- Linen / fabric textures
- Soft grain / film effect

LAYOUT STYLE

- Asymmetrical editorial layout (NOT grid-based)
- Lots of breathing space (whitespace is key)
- Text softly placed, not in heavy blocks
- Slight overlap of elements for editorial feel

TYPOGRAPHY

- Elegant serif (for headings)
- Clean minimal sans-serif (for details)
- Thin, spaced-out typography
- Avoid bold/heavy fonts

TEXT STRUCTURE

- Top Hook (small & subtle):
  Pick ONE from Suggested headlines in DESTINATION PROFILE

- Main Title:
  \"{$title}\"

- Subtitle:
  Include only if not already part of title

- Price:
  \"{$adult_price}\"

- Offer:
  \"{$display_note}\"

- Dates:
  \"{$availability_text}\"

- CTA:
  \"DM TO JOIN\"

DESIGN ELEMENTS

- Thin lines / soft dividers
- Minimal label-style tags
- Subtle underline accents

Optional:
- Paper texture overlay
- Soft shadows
- Grain effect

STRICT RULES

- No clutter, no crowded layout
- No bright or neon colors
- No stickers, badges, or loud banners
- No collage or multiple images
- Avoid aggressive \"SALE\" look
- Maintain calm, premium aesthetic

FOOTER

- \"Powered by www.tripanza.com\" (very subtle)

FINAL LOOK

- Aesthetic + dreamy + feminine
- Soft luxury travel vibe
- Pinterest-worthy
- Calm but scroll-stopping
- Premium yet relatable

OUTPUT

- Instagram Story format (9:16)
- Aesthetic editorial poster
- Clean, soft, high-conversion design";


$prompt_scrapbook = "Create a HIGH-CONVERTING Instagram poster in a VINTAGE SCRAPBOOK / TRAVEL COLLAGE style (NOT clean minimal, NOT modern editorial).

Trip Details:
- Destination: {$display_location}
- Trip name: {$title}
- Duration: {$duration_label}
- Dates: {$formatted_date}" . ($end_date ? " to {$end_date}" : "") . "
- Upcoming Departures: {$availability_text}
- Hosted by: {$company_name}
- Contact: {$host_phone}
- Price: {$price_detail}

Offer:
- {$display_note}

{$destination_block}

DESIGN STYLE (VERY IMPORTANT):

- Vintage travel poster meets scrapbook collage
- Layered torn paper composition
- Rough, imperfect, handmade feel
- Inspired by travel journals, postcards, stamps, old magazines

CORE VISUAL IDEA:

- ONE main traveler (center focus)
  → Young traveler with backpack / camera / map
  → Confident pose, looking sideways or upward

--------------------------------------------------
SCRAPBOOK VISUAL ENGINE
--------------------------------------------------

Use DESTINATION PROFILE above for all landmarks, culture, palette, and headlines.
Layer collage cutouts ONLY from that profile — do NOT mix cultures from other regions.

--------------------------------------------------

COLLAGE STYLE:

- Torn paper edges (VERY IMPORTANT)
- Overlapping cutouts
- Mix of:
  • Landmarks
  • Food
  • Culture
  • Transport
  • Maps / tickets / stamps

- Add vintage textures:
  • Grain
  • Paper noise
  • Ink imperfections

TYPOGRAPHY:

- BIG bold headline:
  Pick ONE from Suggested headlines in DESTINATION PROFILE (or \"LOST IN {$display_location}\")

- Vintage distressed font
- Mix handwritten + typewriter text

TEXT ELEMENTS:

- \"Not all those who wander are lost\"
- \"Get lost. Find {$display_location}\"

- Stickers:
  • \"Adventure Awaits\"
  • \"No plan. No map. No problem\"
  • \"Wander. Explore. Repeat.\"

- Add fake:
  • Passport stamps
  • Boarding tickets
  • Location tags

COLOR SYSTEM:

- Warm vintage tones:
  • Burnt orange
  • Beige
  • Deep red
  • Muted blue / green

- Slight fade + grain (AGED look)

LAYOUT:

1. Top → BIG TITLE
2. Center → Traveler
3. Around → Destination collage
4. Bottom → CTA + price

CTA:

- \"DM / WhatsApp to Join\"
- \"Limited Seats – Book Now\"

IMPORTANT RULES:

- NOT minimal
- NOT modern UI
- NOT vector illustration
- Must feel layered, raw, handmade

FINAL LOOK:

- Destination-specific storytelling
- Scrapbook + travel magazine hybrid
- Emotional + immersive
- Highly detailed & scroll-stopping

OUTPUT:

- Instagram Story (9:16)
- Ultra-detailed collage poster";



$prompt_popart = "Create a HIGH-CONVERTING Instagram poster in a BOLD POP-ART / COMIC STYLE (NOT realistic, NOT vintage scrapbook).

Trip Details:
- Destination: {$display_location}
- Trip name: {$title}
- Duration: {$duration_label}
- Dates: {$formatted_date}" . ($end_date ? " to {$end_date}" : "") . "
- Upcoming Departures: {$availability_text}
- Hosted by: {$company_name}
- Contact: {$host_phone}
- Price: {$price_detail}

Offer:
- {$display_note}

{$destination_block}

DESIGN STYLE (VERY IMPORTANT):

- Pop art + comic poster aesthetic
- Bright, loud, high-energy Gen-Z vibe
- Inspired by party posters, comic books, street graphics

COLOR SYSTEM (STRICT):

- Use ONLY 3–4 bold colors:
  • Hot pink / yellow / blue / black / white
- High contrast
- Flat colors (NO gradients)
- Punchy, vibrant palette

CORE VISUAL:

- ONE main subject:
  → Young traveler / girl / group (cutout style)
  → White outline sticker effect around subject

- Pose:
  → Confident, fun, expressive
  → Party / travel vibe

TYPOGRAPHY (VERY IMPORTANT):

- BIG chunky 3D headline:
  Pick ONE from Suggested headlines in DESTINATION PROFILE (or \"TRIP ALERT\")

- Comic-style fonts:
  → Thick, rounded, playful
  → Drop shadows (hard shadow, offset)

- Text should feel like stickers / blocks

TEXT BLOCKS:

- Use colored rectangles for:
  → Dates
  → Price
  → Offer

Example:
- \"WEDNESDAY 8TH OCT\"
- \"{$price_detail}\"
- \"LIMITED SEATS\"

ELEMENTS:

- Comic shapes:
  → Stars ⭐
  → Arrows ➤
  → Bursts 💥
  → Dots / halftone textures

- Stickers:
  → \"BOOK NOW\"
  → \"LET'S GO\"
  → \"NO PLAN NO PROBLEM\"

- Add:
  → Retro TV / icons / doodles
  → Playful objects matching travel vibe

LAYOUT:

- Asymmetrical but balanced
- Big title dominates
- Subject placed bottom or center
- Text blocks floating around

EFFECTS:

- Bold shadows (hard offset)
- Thick outlines
- Slight grain texture
- Comic halftone pattern

CTA:

- \"DM / WhatsApp to Join\"

IMPORTANT RULES:

- NOT minimal
- NOT realistic photography poster
- NOT vintage
- NOT soft aesthetic

- Must feel:
  → Loud
  → Fun
  → Scroll-stopping
  → Youth-focused

FINAL LOOK:

- Party poster energy
- Gen-Z viral design
- Bold, fun, high contrast
- Instagram ad that pops instantly

OUTPUT:

- Instagram Story (9:16)
- High-energy pop-art poster";



$prompt_polaroid = "Create a HIGH-CONVERTING Instagram Story poster in POLAROID / FILM CAMERA aesthetic.

Trip Details:
- Destination: {$display_location}
- Trip name: {$title}
- Duration: {$duration_label}
- Dates: {$formatted_date}" . ($end_date ? " to {$end_date}" : "") . "
- Upcoming Departures: {$availability_text}
- Hosted by: {$company_name}
- Contact: {$host_phone}
- Price: {$price_detail}

Offer:
- {$display_note}
" . ($timer_text ? "- {$timer_text}\n" : "") . "
{$destination_block}

DESIGN STYLE:
- Warm film tones, soft grain
- Polaroid frames with hand-written captions
- Scrapbook-lite but cleaner than vintage collage
- Nostalgic travel diary feel

VISUAL:
Follow DESTINATION PROFILE above (palette, anchors, mood, host notes).

LAYOUT:
- 1–3 polaroid photos (travel moments)
- Handwritten-style date labels
- Title on tape/sticker element
- Price on small tag
- CTA: \"DM to join\"

RULES:
- Warm beige/cream background
- Soft shadows, film grain
- 9:16 Story format
- Footer: \"Powered by www.tripanza.com\" (subtle)";

$prompt_swiss = "Create a HIGH-CONVERTING Instagram Story poster in SWISS MINIMAL / INTERNATIONAL TYPOGRAPHY style.

Trip Details:
- Destination: {$display_location}
- Trip name: {$title}
- Duration: {$duration_label}
- Dates: {$formatted_date}" . ($end_date ? " to {$end_date}" : "") . "
- Upcoming Departures: {$availability_text}
- Hosted by: {$company_name}
- Contact: {$host_phone}
- Price: {$price_detail}

Offer:
- {$display_note}
" . ($timer_text ? "- {$timer_text}\n" : "") . "
{$destination_block}

DESIGN STYLE:
- Ultra-clean grid layout
- Bold sans-serif typography (Helvetica-style)
- Lots of whitespace
- One accent color only (red OR blue OR black)

VISUAL:
- Single strong travel photo OR minimal geometric shape
- No doodles, no stickers

LAYOUT:
- Hook: \"{$pov}\"
- Large title: \"{$title}\"
- Dates aligned left in small caps
- Price in clean block
- CTA: \"Book now\"

RULES:
- Maximum 2 colors + white
- Perfect alignment
- 9:16 format
- Premium, magazine-quality
- Footer: \"Powered by www.tripanza.com\" (subtle)";

$prompt_adventure = "Create a HIGH-CONVERTING Instagram Story poster in RUGGED ADVENTURE / OUTDOOR EXPEDITION style.

Trip Details:
- Destination: {$display_location}
- Trip name: {$title}
- Duration: {$duration_label}
- Dates: {$formatted_date}" . ($end_date ? " to {$end_date}" : "") . "
- Upcoming Departures: {$availability_text}
- Hosted by: {$company_name}
- Contact: {$host_phone}
- Price: {$price_detail}

Offer:
- {$display_note}
" . ($timer_text ? "- {$timer_text}\n" : "") . "
{$destination_block}

DESIGN STYLE:
- Epic landscape mood (mountains, trails, camps)
- Earth tones + one bold accent (orange or green)
- Action/adventure energy
- National Geographic inspired but youth-friendly

VISUAL:
Follow DESTINATION PROFILE above (palette, anchors, mood, host notes).

LAYOUT:
- Hook: \"{$pov}\"
- Bold expedition-style title
- Dates in rugged badge
- Price + offer clearly visible
- CTA: \"DM / WhatsApp to join\"

RULES:
- Cinematic wide-angle feel
- Strong contrast, readable on mobile
- 9:16 Story format
- Footer: \"Powered by www.tripanza.com\" (subtle)";


$prompt_plaincard = "Create a HIGH-CONVERTING Instagram Story poster in PLAIN & CLEAN / DARK PREMIUM TRIP CARD style (like modern travel-app UI — NOT collage, NOT doodle).

Trip Details:
- Destination: {$display_location}
- Trip name: {$title}
- Duration: {$duration_stats}
- Dates: {$formatted_date}" . ($end_date ? " to {$end_date}" : "") . "
- Upcoming Departures: {$availability_text}
- Hosted by: {$company_name}
- Contact: {$host_phone}
- Price: {$price_detail}

Offer:
- {$display_note}

{$destination_block}

DESIGN STYLE (VERY IMPORTANT):

- Plain, clean, premium mobile UI poster (9:16)
- Dark forest-green to deep emerald gradient header zone (top 40%)
- High contrast: white typography + neon/chartreuse green for key stats
- Soft cream/off-white pill buttons with rounded corners
- Minimal decorative line art (thin white organic curves) — subtle only
- NO clutter, NO stickers, NO vintage textures

HEADER LAYOUT:

- Top-left: small circular profile/brand badge area (use host initials or minimal travel icon — NOT a real logo)
- Top-right stats row in bright green:
  • \"{$duration_stats}\"
  • \"{$adult_price}\"
- Main title (large, bold white sans-serif):
  \"{$title}\"
- Subtitle/tagline (lighter white, smaller):
  Pick a poetic line inspired by DESTINATION PROFILE mood, e.g.
  \"Where Your Soul Finds the View It Deserves\"
  OR \"{$display_location} — A Journey Worth Every Mile\"

CTA BUTTONS (pill-shaped, horizontal row):

- Primary (solid cream): \"Book\"
- Secondary (ghost/outline white): \"Message\"
- Secondary (ghost/outline white): \"Contact\"

MAIN VISUAL (bottom 60%):

- ONE cinematic destination photo (young traveler in scenic {$display_location} setting)
- Use Visual anchors from DESTINATION PROFILE for the scene
- Overlay a subtle white 3x3 composition grid (very thin lines, low opacity)
- Optional thin white flowing line art over photo (minimal, 1–2 curves max)

BOTTOM CTA:

- Centered white pill button: \"Learn more\" with small link icon
- Optional footer line (very small): \"Swipe up · Powered by www.tripanza.com\"

COLOR SYSTEM:

- Background gradient: deep green / emerald (from Palette lock in profile — adapt greens)
- Accent stats: neon/chartreuse green
- Buttons: cream + white outline
- Max 4 colors total

STRICT RULES:

- Do NOT use collage, scrapbook, or pop-art elements
- Do NOT use heavy shadows or 3D effects
- Keep typography clean and modern (Inter / SF Pro style)
- Mobile-first readability
- Destination-specific photo cues from PROFILE — not generic stock travel

OUTPUT:

- Instagram Story (9:16)
- Plain, clean, premium travel-app poster";


$prompt_ticketframe = "Create a HIGH-CONVERTING Instagram Story poster in PLAIN & CLEAN / TRAVEL TICKET FRAME style (minimal ticket overlay on lifestyle photo — NOT vintage scrapbook chaos).

Trip Details:
- Destination: {$display_location}
- Trip name: {$title}
- Duration: {$duration_ticket}
- Dates: {$formatted_date}" . ($end_date ? " to {$end_date}" : "") . "
- Upcoming Departures: {$availability_text}
- Hosted by: {$company_name}
- Contact: {$host_phone}
- Price: {$price_detail}

Offer:
- {$display_note}

{$destination_block}

DESIGN STYLE (VERY IMPORTANT):

- Modern minimalist travel ticket aesthetic
- ONE central lifestyle/travel photo (2 people or solo traveler — candid, aspirational)
- Light beige/cream TICKET FRAME overlay around the subjects
- Frame has rounded outer corners + inward curved \"ticket punch\" cutouts at corners
- Clean, plain, aesthetic — NOT torn paper, NOT messy collage

TYPOGRAPHY (ANGLED — VERY IMPORTANT):

- Small hook phrase ABOVE main title (same angle, thin sans-serif, cream/off-white):
  \"Some Trips Fill Your Gallery\"
  OR pick a short poetic hook from DESTINATION PROFILE mood
- MAIN TITLE (hero element):
  \"{$location_upper}\"
  • Very bold, thick sans-serif (Montserrat Black style)
  • Off-white/cream color
  • Rotated ~10–15° upward diagonal
  • Placed center-top over photo, behind frame edge but above subjects

TICKET FRAME DETAILS:

- Left edge (vertical text along frame):
  \"{$duration_ticket} | {$adult_price}\"
- Small simplified barcode graphic on left side (decorative, minimal lines)
- Bottom-right along frame border (elegant serif, small):
  \"Fills Your Heart.\"
  OR a short closing line matching destination mood

VISUAL:

- Photo scene must match DESTINATION PROFILE (landmarks, culture, palette)
- Subjects framed inside ticket border — they are the focal point
- Background: natural destination colors from profile

CTA:

- Bottom center: white pill button
  \"Visit our website\" OR \"DM to Join\"
  • Small link icon + optional pin emoji
- Hosted by: {$company_name} · Contact: {$host_phone} (small, clean)

BRANDING:

- Top-right: minimal wordmark text \"{$company_name}\" (small, white, clean — NOT loud logo)

COLOR SYSTEM:

- Frame/graphic text: cream, beige, off-white
- Photo: vibrant natural destination colors
- Max 3 graphic colors + photo tones

STRICT RULES:

- Do NOT use multiple overlapping cutouts or vintage distress
- Do NOT use neon or party-poster energy
- Keep layout plain, balanced, scroll-stopping
- All cultural elements from ONE destination only (PROFILE)

OUTPUT:

- Instagram Story (9:16)
- Plain & clean ticket-frame travel poster";


$prompt_scenicoverlay = "Create a HIGH-CONVERTING Instagram Story poster in PLAIN & CLEAN / SCENIC OVERLAY + DATA PILLS style (vibrant photo + minimal UI overlays — NOT editorial collage).

Trip Details:
- Destination: {$display_location}
- Trip name: {$title}
- Duration: {$duration_stats}
- Dates: {$formatted_date}" . ($end_date ? " to {$end_date}" : "") . "
- Upcoming Departures: {$availability_text}
- Hosted by: {$company_name}
- Contact: {$host_phone}
- Price: {$price_detail}

Offer:
- {$display_note}

{$destination_block}

DESIGN STYLE (VERY IMPORTANT):

- Full-bleed scenic travel photograph (high quality, bright, natural light)
- Minimal UI overlays — plain, clean, Instagram-ad quality
- Influencer/travel-brand aesthetic with strong destination identity
- ONE main character (young traveler) integrated naturally in the landscape
- Optional colorful local prop (scooter, bike, jeep) using Transport icons from PROFILE

MAIN TITLE OVERLAY:

- Large bold ALL-CAPS sans-serif: \"{$location_upper}\"
- Centered upper-middle of frame
- Semi-transparent white (~40–50% opacity) — background photo visible through letters
- Clean, modern, dominant but subtle
- Optional second line below title (small, spaced caps): short trip name or route e.g. \"{$title}\"
- Title stays TOP CENTER only — never stacked on the left

DATA PILLS (right side stack ONLY):

- Price pill: soft yellow/cream background, green text
  \"{$adult_price}\"
- Duration pill: white background, thin green border
  Sun icon + moon icon + \"{$duration_ticket}\"
- Offer pill (small): \"{$display_note}\"

LEFT SIDE OF IMAGE:

- Keep completely clean — NO text, NO pills, NO description boxes on the left
- Let the photo breathe; do not place copy on lower-left or mid-left

BRANDING:

- Top-right corner: small clean text \"Hosted by {$company_name}\" (white, minimal)

VISUAL SCENE:

- Follow DESTINATION PROFILE for landscape, anchors, and mood
- Turquoise lakes, arid mountains, beaches, streets — match the location
- Natural blues/earth tones + ONE accent pop (yellow vehicle or green UI highlights)

STRICT RULES:

- Do NOT use ticket frames, dark header cards, or scrapbook elements
- Do NOT add left-side description pills, callout boxes, speech bubbles, or poetic caption text
- Do NOT add \"main character\", \"sisterhood\", or mood copy anywhere on the poster
- UI overlays ONLY: top-center title (+ optional subtitle) + right-side data pills + bottom CTA/footer
- No doodles, no comic effects, no heavy gradients on photo
- Photo must feel destination-specific (ANTI-GENERIC rule from PROFILE)

CTA:

- Small clean line near bottom: \"DM / WhatsApp to book · {$host_phone}\"

FOOTER:

- \"Powered by www.tripanza.com\" (very subtle, bottom center)

OUTPUT:

- Instagram Story (9:16)
- Plain, clean, scenic overlay travel poster";


$prompt_packagenight = "Create a HIGH-CONVERTING Instagram Story poster matching this reference layout: centered adventure PACKAGE poster on destination-accurate night/evening photo (NOT left-aligned, NOT Wanderon stack).

Trip Details:
- Destination: {$display_location}
- Trip name: {$title}
- Duration: {$duration_ticket} Package
- Dates: {$formatted_date}" . ($end_date ? " to {$end_date}" : "") . "
- Upcoming Batch: {$availability_text}
- Hosted by: {$company_name}
- Contact: {$host_phone}
- Price: {$price_detail}

Offer:
- {$display_note}

{$destination_block}

NIGHT SCENE (destination-accurate — VERY IMPORTANT):
{$package_night_scene}

{$package_inclusions_block}

REFERENCE LAYOUT (CENTER-ALIGNED):

BACKGROUND:
- Full-bleed vertical photo matching NIGHT SCENE above and DESTINATION PROFILE
- Top: dark sky gradient (starry or moody — match region)
- Bottom: destination-appropriate evening activity (NOT generic bonfire camp unless region allows)
- NEVER use snowy mountain bonfire for beaches, cities, Kerala, Europe, Japan, etc.

TOP BRANDING (center):
- Small white text: \"Tripanza presents\"
- Below: stylized host name \"{$company_name}\" in purple rounded bubble lettering with small smiley accent

HOOK (center, white sans-serif):
\"Want your weekend to look like this?\"
OR a short hook matching {$display_location} mood from PROFILE

MAIN TITLE (center, large bold white sans-serif):
\"{$display_location}\"

DURATION TAG (center):
- Small slanted purple rectangle pill with white text: \"{$duration_ticket} Package\"

PRICE BAR (center — horizontal pill):
- Semi-transparent dark grey rounded pill with thin white border
- LEFT half: \"Upcoming Batch\" + dates: \"{$availability_text}\"
- RIGHT half: \"Starting from\" + \"{$adult_price}\" in bright yellow ONLY (show price once — do NOT repeat \"Starting @\")
- Divider line between halves

FEATURE ICON GRID (center):
- Dashed-line rounded rectangle container
- Use the supplied number of thin WHITE line icons in a balanced grid; omit the grid when none are supplied
- Use ONLY the saved PACKAGE INCLUSIONS listed above — each with matching icon + short label
- Icons must reflect THIS destination (e.g. houseboat for Kerala, scooter for Goa, desert for Rajasthan)

NO CTA BUTTONS:
- Do NOT add \"Enquire Now\" button
- Do NOT add \"Get quote\" button
- Do NOT add any yellow/white pill action buttons
- Photo and info should extend lower — footer contact only

FOOTER (center, small white):
\"DM / WhatsApp · {$host_phone}\"
\"Powered by www.tripanza.com\" (very subtle)

COLOR SYSTEM:
- Background: dark sky + destination evening tones (from PROFILE palette)
- Accents: purple (brand/tag), bright yellow (price text only), white text
- Max 4 UI colors

STRICT RULES:
- EVERYTHING center-aligned — NO left-side description pills
- NO bonfire/campfire unless NIGHT SCENE above explicitly allows it for this destination
- NO generic inclusion icons copied across all trips
- NO Enquire Now / Get quote buttons anywhere
- Match reference composition: center stack + icon grid + footer contact only

OUTPUT:
- Instagram Story (9:16)
- Centered destination-specific package poster";


$prompt_packagescenic = "Create a HIGH-CONVERTING Instagram Story poster matching EXACTLY this reference layout: centered adventure PACKAGE poster on bright scenic nature photo (Chyll / zingbus waterfall style — NOT night camp grid, NOT Wanderon left stack).

Trip Details:
- Destination: {$display_location}
- Trip name: {$title}
- Duration: {$duration_ticket} Package
- Dates: {$formatted_date}" . ($end_date ? " to {$end_date}" : "") . "
- Upcoming Batch: {$availability_text}
- Hosted by: {$company_name}
- Contact: {$host_phone}
- Price: {$price_detail}

Offer:
- {$display_note}

{$destination_block}

{$package_inclusions_block}

REFERENCE LAYOUT (CENTER-ALIGNED):

BACKGROUND:
- Full-bleed vertical scenic photo of {$display_location}
- Lush nature scene (waterfall, forest, river, mountains — match PROFILE anchors)
- One traveler seen from behind at bottom for scale (optional)
- Bright natural daylight

TOP BRANDING (center):
- Small purple pill: \"Tripanza presents\"
- Bold stylized \"{$company_name}\" logo treatment in purple + white with playful emoji accent

HOOK (center, white clean sans-serif):
\"Want a weekend away from city noise?\"

SUB-HEAD (center):
- \"Try the\" with thin horizontal white lines on left and right

MAIN TITLE (center):
- \"{$display_location}\" in LARGE bold white TEXTURED font (chalk/stamped/distressed effect — must pop)

DURATION (center):
- \"{$duration_ticket} Package\" in bold yellow + white sans-serif

ICON BAR (center — single horizontal row):
- ONE wide blurred semi-transparent dark rounded bar
- Use the supplied number of white line icons in a SINGLE horizontal row; omit the row when none are supplied
- Use ONLY the saved PACKAGE INCLUSIONS listed above — each with matching icon + short label
- Entire bar centered on poster

INFO BOXES (center — side by side):
- TWO white rounded rectangles, equal width, centered horizontally
- LEFT box: \"Upcoming Batch\" + \"{$availability_text}\"
- RIGHT box: small purple pill \"Starting from\" + \"{$adult_price}\" (show price once — do NOT repeat \"Starting @\")

NO CTA BUTTONS:
- Do NOT add \"Enquire Now\" button
- Do NOT add \"Get quote\" button
- Do NOT add any yellow/white pill action buttons

FOOTER (center, small):
\"DM / WhatsApp · {$host_phone}\"
\"Powered by www.tripanza.com\" (subtle)

STRICT RULES:
- Strict CENTER alignment for all overlays
- When saved inclusions exist, keep the icon bar in ONE horizontal row — NOT a 3×2 grid
- NO left-aligned text stacks
- NO dark night sky header (that is Package Night style)
- NO poetic caption pills on left or right
- NO Enquire Now / Get quote buttons anywhere
- Glassmorphism blur on icon bar and info boxes only

OUTPUT:
- Instagram Story (9:16)
- Centered scenic package poster";


$prompt_groupstack = "Create a HIGH-CONVERTING Instagram Story poster matching EXACTLY this reference layout: LEFT-ALIGNED group trip stack poster (Wanderon-style — NOT center-aligned package poster).

Trip Details:
- Destination: {$display_location}
- Trip name: {$title}
- Duration: {$duration_wanderon}
- Dates: {$formatted_date}" . ($end_date ? " to {$end_date}" : "") . "
- Upcoming Departures: {$availability_text}
- Hosted by: {$company_name}
- Contact: {$host_phone}
- Price: {$price_detail}

Offer:
- {$display_note}

{$destination_block}

REFERENCE LAYOUT (MATCH EXACTLY — LEFT-ALIGNED):

BACKGROUND:
- Full-bleed vertical lifestyle photo: young group of friends trekking/walking in {$display_location}
- Natural outdoor scene (river rocks, forest, mountains — from PROFILE)
- Subjects slightly center-right so LEFT side has clean space for text

TOP RIGHT:
- Small white host mark: \"Hosted by {$company_name}\" with minimal pin/location icon (NOT Wanderon logo — use Tripanza host branding)

LEFT STACK TITLE (very important — left aligned, upper-left quadrant):
Stack destination names vertically, one per line, extra-bold white ALL-CAPS sans-serif:
{$location_stack}
- Place a small solid YELLOW square accent to the right of the FIRST line only
- Below stack: \"Group Trips\" in bold white (slightly smaller)

DURATION PILL (left, below title stack):
- Bright yellow rounded pill, black bold text: \"{$duration_wanderon}\"

PRICE BOX (left, below duration pill):
- Dark forest-green semi-transparent rounded rectangle
- Split by thin vertical white line into TWO halves:
  • LEFT: white stacked text \"Packages Starting @\"
  • RIGHT: large bold YELLOW \"{$adult_price}\" with small white \"Per Person\" below

FREQUENCY LINE (left, below price box):
- Bold yellow sans-serif: \"Batches Depart Every Week\"
  OR if dates available: \"Upcoming: {$availability_text}\"

BOTTOM CTA (left or center-bottom):
- \"DM / WhatsApp to book · {$host_phone}\" in white/yellow

FOOTER:
- \"Powered by www.tripanza.com\" (small, bottom center)

COLOR SYSTEM:
- Text/UI: white, bright yellow, dark green overlay box only
- Photo: natural greens and earth tones from destination

STRICT RULES:
- ALL main text and UI on LEFT half — strict left alignment
- NO center-aligned package layout (that is Package Night / Scenic style)
- NO icon feature grid or dashed box
- NO purple brand bubbles (that is Chyll package style)
- NO description pills or poetic copy anywhere
- NO semi-transparent location title across center
- Stack multiple place names if trip covers multiple stops; if single destination use one bold line only

OUTPUT:
- Instagram Story (9:16)
- Left-aligned group trip stack poster";



$prompt_cinematic = htmlspecialchars($prompt_cinematic);
$prompt_clean = htmlspecialchars($prompt_clean);
$prompt_vibrant = htmlspecialchars($prompt_vibrant);
$prompt_doodle = htmlspecialchars($prompt_doodle);
$prompt_tropical = htmlspecialchars($prompt_tropical);
$prompt_luxury = htmlspecialchars($prompt_luxury);
$prompt_luxuryproduct = htmlspecialchars($prompt_luxuryproduct);
$prompt_editorial = htmlspecialchars($prompt_editorial);
$prompt_editorialold = htmlspecialchars($prompt_editorialold);
$prompt_editorialtravelold = htmlspecialchars($prompt_editorialtravelold);
$prompt_editorialproductold = htmlspecialchars($prompt_editorialproductold);
$prompt_scrapbook = htmlspecialchars($prompt_scrapbook);
$prompt_popart = htmlspecialchars($prompt_popart);
$prompt_polaroid = htmlspecialchars($prompt_polaroid);
$prompt_swiss = htmlspecialchars($prompt_swiss);
$prompt_adventure = htmlspecialchars($prompt_adventure);
$prompt_plaincard = htmlspecialchars($prompt_plaincard);
$prompt_ticketframe = htmlspecialchars($prompt_ticketframe);
$prompt_scenicoverlay = htmlspecialchars($prompt_scenicoverlay);
$prompt_packagenight = htmlspecialchars($prompt_packagenight);
$prompt_packagescenic = htmlspecialchars($prompt_packagescenic);
$prompt_groupstack = htmlspecialchars($prompt_groupstack);
?>

<div class="tz-share-card">

    <div class="tz-share-card__head">
        <h3 class="tz-share-card__title"><?php echo esc_html($title); ?></h3>
        <?php if ( $duration_label !== '' ) : ?>
            <span class="tz-share-chip"><?php echo esc_html( $duration_label ); ?></span>
        <?php endif; ?>
    </div>

    <div class="tz-share-card__meta">
        <?php if ( ! empty( $formatted_date ) ) : ?>
            <span class="tz-share-meta-pill"><i class="fa-regular fa-calendar"></i> <?php echo esc_html( $formatted_date . ( $end_date ? ' - ' . $end_date : '' ) ); ?></span>
        <?php endif; ?>
        <?php if ( ! empty( $display_note ) ) : ?>
            <span class="tz-share-meta-pill"><i class="fa-solid fa-tag"></i> <?php echo esc_html( $display_note ); ?></span>
        <?php endif; ?>
    </div>

   <div class="tz-share-field style-group">
    <label class="style-label">Choose poster style</label>

    <select class="style-select">
        <optgroup label="Recommended">
            <option value="tropical" selected>Tropical Doodle</option>
            <option value="editorial">Minimalistic Travel (New)</option>
            <option value="editorialtravelold">Minimalistic Travel (Old)</option>
            <option value="editorialold">Minimalistic Product (New)</option>
            <option value="editorialproductold">Minimalistic Product (Old)</option>
            <option value="polaroid">Polaroid / Film</option>
            <option value="luxury">Aesthetic Travel</option>
            <option value="luxuryproduct">Aesthetic Product</option>
        </optgroup>
        <optgroup label="Bold &amp; energetic">
            <option value="cinematic">Cinematic &amp; GenZ</option>
            <option value="vibrant">Vibrant &amp; Energetic</option>
            <option value="scrapbook">Vintage Scrapbook</option>
            <option value="popart">Pop Art / Comic</option>
        </optgroup>
        <optgroup label="Plain &amp; clean">
            <option value="plaincard">Dark Trip Card</option>
            <option value="ticketframe">Travel Ticket Frame</option>
            <option value="scenicoverlay">Scenic Overlay + Pills</option>
        </optgroup>
        <optgroup label="Package &amp; group trip">
            <option value="packagenight">Package Poster — Night Camp</option>
            <option value="packagescenic">Package Poster — Scenic Center</option>
            <option value="groupstack">Group Trip Stack</option>
        </optgroup>
        <optgroup label="Clean &amp; minimal">
            <option value="clean">Decent &amp; Clean</option>
            <option value="swiss">Swiss Typography</option>
        </optgroup>
        <optgroup label="Illustration &amp; aesthetic">
            <option value="doodle">Doodle &amp; Illustration</option>
            <option value="adventure">Rugged Adventure</option>
        </optgroup>
    </select>
</div>

<div class="tz-share-actions">
<button class="tz-share-btn tz-share-btn--primary btn" onclick="copyPrompt(this)">
    <i class="fa-regular fa-copy"></i> Copy selected prompt
</button>
<textarea class="prompt-doodle" style="display:none;"><?php echo $prompt_doodle; ?></textarea>
<textarea class="prompt-cinematic" style="display:none;"><?php echo $prompt_cinematic; ?></textarea>
<textarea class="prompt-clean" style="display:none;"><?php echo $prompt_clean; ?></textarea>
<textarea class="prompt-vibrant" style="display:none;"><?php echo $prompt_vibrant; ?></textarea>
<textarea class="prompt-editorial" style="display:none;"><?php echo $prompt_editorial; ?></textarea>
<textarea class="prompt-editorialtravelold" style="display:none;"><?php echo $prompt_editorialtravelold; ?></textarea>
<textarea class="prompt-editorialold" style="display:none;"><?php echo $prompt_editorialold; ?></textarea>
<textarea class="prompt-editorialproductold" style="display:none;"><?php echo $prompt_editorialproductold; ?></textarea>
<textarea class="prompt-tropical" style="display:none;"><?php echo $prompt_tropical; ?></textarea>
<textarea class="prompt-luxury" style="display:none;"><?php echo $prompt_luxury; ?></textarea>
<textarea class="prompt-luxuryproduct" style="display:none;"><?php echo $prompt_luxuryproduct; ?></textarea>
<textarea class="prompt-scrapbook" style="display:none;"><?php echo $prompt_scrapbook; ?></textarea>

<textarea class="prompt-popart" style="display:none;"><?php echo $prompt_popart; ?></textarea>
<textarea class="prompt-polaroid" style="display:none;"><?php echo $prompt_polaroid; ?></textarea>
<textarea class="prompt-swiss" style="display:none;"><?php echo $prompt_swiss; ?></textarea>
<textarea class="prompt-adventure" style="display:none;"><?php echo $prompt_adventure; ?></textarea>
<textarea class="prompt-plaincard" style="display:none;"><?php echo $prompt_plaincard; ?></textarea>
<textarea class="prompt-ticketframe" style="display:none;"><?php echo $prompt_ticketframe; ?></textarea>
<textarea class="prompt-scenicoverlay" style="display:none;"><?php echo $prompt_scenicoverlay; ?></textarea>
<textarea class="prompt-packagenight" style="display:none;"><?php echo $prompt_packagenight; ?></textarea>
<textarea class="prompt-packagescenic" style="display:none;"><?php echo $prompt_packagescenic; ?></textarea>
<textarea class="prompt-groupstack" style="display:none;"><?php echo $prompt_groupstack; ?></textarea>

    <p class="tz-share-note note">Copy the prompt, or open it directly in ChatGPT.</p>

<button class="tz-share-btn tz-share-btn--accent btn generate-btn" onclick="openChatGPT(this)">
    <i class="fa-solid fa-rocket"></i> Generate in ChatGPT
</button>
</div>

</div>

<?php endwhile; wp_reset_postdata(); ?>

        </div>

        <section class="tz-share-settings" id="povEditCard">
            <div class="tz-share-settings__head">
                <i class="fa-solid fa-quote-left"></i>
                <div>
                    <h2>Default POV hook</h2>
                    <p>Used at the top of every generated poster prompt</p>
                </div>
            </div>

            <form method="post">
                <?php wp_nonce_field('tripanza_original_pov', 'tripanza_pov_nonce'); ?>
                <div class="tz-share-field form-group">
                    <label for="trip_pov_text">POV text</label>
                    <input type="text" id="trip_pov_text" name="trip_pov_text" value="<?php echo esc_attr($pov); ?>">
                    <button type="submit" class="tz-share-btn tz-share-save save-btn">Save POV</button>
                </div>
            </form>

            <?php if(!empty($saved)): ?>
                <div class="tz-share-alert note">Saved successfully</div>
            <?php endif; ?>
        </section>
    </div>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    document.body.classList.add('tz-share-console');
});
</script>

<script>
// Filter Trips Logic
function filterMyTrips() {
    const searchInput = document.getElementById('tripSearchFilter').value.toLowerCase();
    const cards = document.querySelectorAll('#tzShareGrid .tz-share-card');
    let visibleCount = 0;

    cards.forEach(function(card) {
        const titleElement = card.querySelector('.tz-share-card__title');
        if (!titleElement) {
            return;
        }

        const titleText = titleElement.innerText.toLowerCase();
        const isVisible = titleText.includes(searchInput);
        card.style.display = isVisible ? '' : 'none';
        if (isVisible) {
            visibleCount += 1;
        }
    });

    const countEl = document.getElementById('tzShareVisibleCount');
    if (countEl) {
        countEl.textContent = String(visibleCount);
    }
}

function getSelectedPromptText(card) {
    const selected = card.querySelector('.style-select').value;
    const textarea = card.querySelector('.prompt-' + selected);
    return textarea ? textarea.value : '';
}

function copyPrompt(btn){
    const card = btn.closest('.tz-share-card');
    const text = getSelectedPromptText(card);

    if (!text) {
        window.alert('Prompt not found for the selected style.');
        return;
    }

    navigator.clipboard.writeText(text).then(() => {
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        setTimeout(() => {
            btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy selected prompt';
        }, 2000);
    });
}

function openChatGPT(btn){
    const card = btn.closest('.tz-share-card');
    const text = getSelectedPromptText(card);

    if (!text) {
        window.alert('Prompt not found for the selected style.');
        return;
    }

    const encoded = encodeURIComponent(text);
    const url = "https://chat.openai.com/?q=" + encoded;
    window.open(url, '_blank');
}
</script>

