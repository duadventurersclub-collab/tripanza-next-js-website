<?php
// Financial helpers preserved from the supplied editor; checkout totals remain immutable.
defined('ABSPATH') || exit;
if (!function_exists('tripanza_native_editor_number')) {
    function tripanza_native_editor_number($value, $allow_negative = false) {
        $number = is_numeric($value) ? (float) $value : 0.0;
        return $allow_negative ? $number : max(0.0, $number);
    }
}

if (!function_exists('tripanza_native_editor_item_cost')) {
    function tripanza_native_editor_item_cost($counts, $prices, $extras) {
        $total = 0.0;
        foreach (array('adult', 'child', 'infant') as $type) {
            $total += tripanza_native_editor_number($counts[$type] ?? 0) * tripanza_native_editor_number($prices[$type] ?? 0);
        }

        if (is_array($extras) && !empty($extras['value']) && is_array($extras['value'])) {
            foreach ($extras['value'] as $key => $quantity) {
                $price = isset($extras['price'][$key]) ? $extras['price'][$key] : 0;
                $total += tripanza_native_editor_number($price) * tripanza_native_editor_number($quantity);
            }
        }

        return round($total, 2);
    }
}

if (!function_exists('tripanza_native_editor_sale_amount')) {
    function tripanza_native_editor_sale_amount($counts, $prices, $rate, $type = 'percent') {
        $people = 0;
        $gross = 0.0;
        foreach (array('adult', 'child', 'infant') as $person_type) {
            $quantity = (int) tripanza_native_editor_number($counts[$person_type] ?? 0);
            $unit_price = tripanza_native_editor_number($prices[$person_type] ?? 0);
            $people += $quantity;
            $gross += $quantity * $unit_price;
        }

        $rate = tripanza_native_editor_number($rate);
        $sale = $type === 'amount'
            ? $rate * $people
            : $gross * (min(100, $rate) / 100);

        return round(min($gross, max(0, $sale)), 2);
    }
}

if (!function_exists('tripanza_native_editor_bulk_discount_for_group')) {
    function tripanza_native_editor_bulk_discount_for_group($rules, $quantity, $group_subtotal, $discount_type = 'percent') {
        if ($quantity <= 0 || $group_subtotal <= 0 || !is_array($rules)) {
            return 0.0;
        }

        $matching_rule = null;
        $matching_from = -1;
        foreach ($rules as $rule) {
            if (!is_array($rule)) continue;
            $from = isset($rule['key']) ? max(0, absint($rule['key'])) : 0;
            if ($quantity >= $from && $from >= $matching_from) {
                $matching_rule = $rule;
                $matching_from = $from;
            }
        }
        if (!$matching_rule) return 0.0;

        $value = tripanza_native_editor_number($matching_rule['value'] ?? 0);
        $discount = $discount_type === 'amount'
            ? $value
            : $group_subtotal * (min(100, $value) / 100);

        return round(min($group_subtotal, max(0, $discount)), 2);
    }
}

if (!function_exists('tripanza_native_editor_group_discount')) {
    function tripanza_native_editor_group_discount($counts, $prices, $sale_rate, $sale_type, $adult_rules, $child_rules, $bulk_type) {
        $adult_quantity = (int) tripanza_native_editor_number($counts['adult'] ?? 0);
        $child_quantity = (int) tripanza_native_editor_number($counts['child'] ?? 0);
        $adult_gross = $adult_quantity * tripanza_native_editor_number($prices['adult'] ?? 0);
        $child_gross = $child_quantity * tripanza_native_editor_number($prices['child'] ?? 0);
        $sale_rate = tripanza_native_editor_number($sale_rate);

        if ($sale_type === 'amount') {
            $adult_subtotal = max(0, $adult_gross - ($sale_rate * $adult_quantity));
            $child_subtotal = max(0, $child_gross - ($sale_rate * $child_quantity));
        } else {
            $sale_factor = 1 - (min(100, $sale_rate) / 100);
            $adult_subtotal = max(0, $adult_gross * $sale_factor);
            $child_subtotal = max(0, $child_gross * $sale_factor);
        }

        return round(
            tripanza_native_editor_bulk_discount_for_group($adult_rules, $adult_quantity, $adult_subtotal, $bulk_type)
            + tripanza_native_editor_bulk_discount_for_group($child_rules, $child_quantity, $child_subtotal, $bulk_type),
            2
        );
    }
}

if (!function_exists('tripanza_native_editor_normalize_date')) {
    function tripanza_native_editor_normalize_date($value) {
        if ($value === null || $value === '') {
            return '';
        }

        if (is_numeric($value)) {
            $timestamp = (int) $value;
            if ($timestamp > 20000000000) $timestamp = (int) floor($timestamp / 1000);
            return $timestamp > 0 ? wp_date('Y-m-d', $timestamp, wp_timezone()) : '';
        }

        $value = trim((string) $value);
        $formats = array('Y-m-d');
        if (is_callable(array('TravelHelper', 'getDateFormat'))) $formats[] = TravelHelper::getDateFormat();
        foreach (array_unique(array_merge($formats, array('d/m/Y', 'm/d/Y', 'd-m-Y', 'm-d-Y'))) as $format) {
            $date = DateTimeImmutable::createFromFormat('!' . $format, $value, wp_timezone()); $errors = DateTimeImmutable::getLastErrors();
            if ($date && ($errors === false || (!$errors['warning_count'] && !$errors['error_count']))) return $date->format('Y-m-d');
        }
        return '';
    }
}

if (!function_exists('tripanza_native_editor_financial_summary')) {
    function tripanza_native_editor_financial_summary($order_id, $data_prices, $adjustment = null) {
        $data_prices = is_array($data_prices) ? $data_prices : array();
        $tax_percent = tripanza_native_editor_number(get_post_meta($order_id, 'st_tax_percent', true));
        $adjustment = $adjustment === null
            ? tripanza_native_editor_number(get_post_meta($order_id, 'admin_backend_adjustment', true), true)
            : tripanza_native_editor_number($adjustment, true);

        /* total_price_with_tax is already net of Tripanza Sale, group discount and wallet/coupon. */
        $base_total = tripanza_native_editor_number($data_prices['total_price_with_tax'] ?? 0);
        $booking_fee = tripanza_native_editor_number(get_post_meta($order_id, 'booking_fee_price', true));
        if ($booking_fee <= 0) {
            $booking_fee = tripanza_native_editor_number($data_prices['booking_fee_price'] ?? 0);
        }

        /* Legacy fallback only: reconstruct orders that predate the saved final-total snapshot. */
        if ($base_total <= 0) {
            $legacy_origin = tripanza_native_editor_number(get_post_meta($order_id, 'ori_price', true));
            $legacy_taxable = max(0, $legacy_origin - $booking_fee);
            $legacy_coupon = tripanza_native_editor_number($data_prices['coupon_price'] ?? 0);
            $base_total = max(0, (float) STPrice::getTotalPriceWithTaxInOrder($legacy_taxable, $order_id) - $legacy_coupon);
        }

        $adjustment_tax = round($adjustment * ($tax_percent / 100), 2);
        $raw_final_total = round($base_total + $booking_fee + $adjustment + $adjustment_tax, 2);
        $final_total = max(0, $raw_final_total);
        // An explicitly saved zero is meaningful; only absent legacy values use the deposit.
        $amount_paid = tripanza_native_editor_number(array_key_exists('total_price', $data_prices)
            ? $data_prices['total_price'] : ($data_prices['deposit_price'] ?? 0));

        $status = str_replace('-', '_', sanitize_key((string) get_post_meta($order_id, 'status', true)));
        $closed_statuses = array('complete', 'completed', 'fully_paid', 'refunded', 'canceled', 'cancelled');
        $balance = in_array($status, $closed_statuses, true) ? 0.0 : max(0, round($final_total - $amount_paid, 2));
        $overpayment = in_array($status, array('refunded', 'canceled', 'cancelled'), true)
            ? 0.0
            : max(0, round($amount_paid - $final_total, 2));

        return array(
            'base_total'       => $base_total,
            'booking_fee'      => $booking_fee,
            'tax_percent'      => $tax_percent,
            'adjustment'       => $adjustment,
            'adjustment_tax'   => $adjustment_tax,
            'raw_final_total'  => $raw_final_total,
            'final_total'      => $final_total,
            'amount_paid'      => $amount_paid,
            'balance'          => $balance,
            'overpayment'      => $overpayment,
            'status'           => $status,
        );
    }
}
