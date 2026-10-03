<?php
defined("ABSPATH") || exit;
function tripanza_native_default_holidays() {
$default_holidays = array(
    array('date' => 'Aug 14 - Aug 17', 'name' => 'Independence Day Extended Weekend Window', 'desc' => '4 Days (Thu - Sun) - High Pan-India Youth Search Surge', 'category' => 'general'),
    array('date' => 'Oct 2 - Oct 4', 'name' => 'Gandhi Jayanti Planning Window', 'desc' => '3 Days (Fri - Sun) - Corporate Mid-Week Impulse Booking Period', 'category' => 'corporate'),
    array('date' => 'Oct 18 - Oct 24', 'name' => 'Diwali Festival Booking Surge', 'desc' => '7 Days - Peak Advance Planning Window across Tier 1 & 2', 'category' => 'festive'),
    array('date' => 'Oct 25 - Oct 31', 'name' => 'DU Mid-Semester Break Planning Window', 'desc' => '7 Days - High Student Inquiry Volume Post Exam Timetable', 'category' => 'du'),
    array('date' => 'Dec 19 - Jan 2', 'name' => 'NCR Winter Vacation Planning Window', 'desc' => '14 Days - Extended Year-End Leave-Bridging Window', 'category' => 'du'),
    array('date' => 'Oct 15 - Oct 20', 'name' => 'IPU Sports Meet Break Window', 'desc' => '5 Days - Short Getaway Planning Spike for College Youth', 'category' => 'ipu'),
    array('date' => 'Oct 22 - Oct 26', 'name' => 'Amity Founders Day Break Window', 'desc' => '5 Days - Advance Group Discussion & Budget Consensus Period', 'category' => 'amity'),
    array('date' => 'Sep 14 - Sep 18', 'name' => 'Ganesh Chaturthi Planning Window', 'desc' => '5 Days - Regional Monsoon Travel Surge for Mumbai/Pune', 'category' => 'mumbai'),
    array('date' => 'Oct 10 - Oct 19', 'name' => 'Navratri Festival Planning Window', 'desc' => '5-7 Days - Gujarat Youth Group Advance Booking Spike', 'category' => 'gujarat'),
    array('date' => 'Nov 1 - Nov 4', 'name' => 'Bangalore Tech-Hub Long Weekend Window', 'desc' => '4 Days - IT Corporate & Tech Youth Advance Booking Spike', 'category' => 'bangalore'),
    array('date' => 'Dec 25 - Dec 28', 'name' => 'Christmas Corporate Retreat Window', 'desc' => '4 Days (Fri - Mon) - Year-End Corporate Stress-Relief Window', 'category' => 'corporate'),
    array('date' => 'Custom Date', 'name' => 'Custom Group Planning Window', 'desc' => 'Tailored custom calendar slot for private groups', 'category' => 'custom'),
);


return $default_holidays;
}

