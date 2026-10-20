-- Double-entry check: were any of the 26 new old-system receipts ALSO entered
-- in the new system? Read-only. Matches company + date (+ pax / price).
SELECT
  n.receipt_id, n.company_name, n.booking_type, n.product AS old_product,
  n.booking_date, n.pax AS old_pax, n.total_rm AS old_rm,
  b.id AS new_booking_id, b.tourist_full_name, b.product_name AS new_product,
  (b.no_of_pax_domestik + b.no_of_pax_antarbangsa) AS new_pax, b.total_price AS new_rm, b.status,
  CASE
    WHEN b.id IS NULL THEN 'no booking that day'
    WHEN (b.no_of_pax_domestik + b.no_of_pax_antarbangsa) = n.pax AND b.total_price = n.total_rm THEN 'LIKELY DUPLICATE'
    WHEN (b.no_of_pax_domestik + b.no_of_pax_antarbangsa) = n.pax OR b.total_price = n.total_rm THEN 'possible - check'
    ELSE 'same day, different booking'
  END AS verdict
FROM (
  VALUES
    ROW('PE4669789', 'Dapako Hill - Lingga Eco Tourism', 'activity', 'Flyingfox', '2026-09-12', 21, 735, '2026-09-14 14:02:55'),
    ROW('PE0318767', 'Dapako Hill - Lingga Eco Tourism', 'activity', 'walai Dapako', '2026-09-13', 7, 960, '2026-09-14 14:04:37'),
    ROW('PE9016775', 'Dapako Hill - Lingga Eco Tourism', 'activity', 'Tent/khemah', '2026-09-13', 17, 175, '2026-09-14 14:06:50'),
    ROW('PE6740095', 'Dapako Hill - Lingga Eco Tourism', 'activity', 'yuran masuk', '2026-09-12', 15, 300, '2026-09-14 14:09:32'),
    ROW('PE1720896', 'Dapako Hill - Lingga Eco Tourism', 'activity', 'katering makanan', '2026-09-13', 23, 667, '2026-09-15 07:45:54'),
    ROW('PE2847985', 'Disan Baang Kiulu', 'accommodation', 'chalet', '2026-09-18', 18, 1450, '2026-09-18 09:45:58'),
    ROW('PE3400460', 'Disan Baang Kiulu', 'activity', 'piknik', '2026-09-16', 7, 86, '2026-09-19 12:12:33'),
    ROW('PE9738074', 'Disan Baang Kiulu', 'accommodation', 'chalet', '2026-09-18', 18, 1470, '2026-09-19 12:13:28'),
    ROW('PE5210842', 'Disan Baang Kiulu', 'activity', 'perkhemahan', '2026-09-19', 28, 394, '2026-09-19 12:16:09'),
    ROW('PE5064621', 'Disan Baang Kiulu', 'accommodation', 'chalet', '2026-09-19', 7, 155, '2026-09-19 12:17:29'),
    ROW('PE2788661', 'Disan Baang Kiulu', 'activity', 'piknik', '2026-09-19', 4, 20, '2026-09-19 12:18:24'),
    ROW('PE7000400', 'Murug Turug Eco Tourism', 'activity', 'Pakej A (Hiking)', '2026-09-20', 6, 122, '2026-09-20 03:47:02'),
    ROW('PE7651353', 'Murug Turug Eco Tourism', 'activity', 'Pakej B (Hiking)', '2026-09-20', 49, 1029, '2026-09-20 03:47:29'),
    ROW('PE7134624', 'Murug Turug Eco Tourism', 'activity', 'Pakej C (Hiking)', '2026-09-20', 12, 567, '2026-09-20 03:47:52'),
    ROW('PE1059490', 'Disan Baang Kiulu', 'activity', 'Team building', '2026-09-23', 14, 250, '2026-09-23 00:40:40'),
    ROW('PE8720687', 'Disan Baang Kiulu', 'activity', 'piknik', '2026-09-25', 9, 83, '2026-09-26 02:37:22'),
    ROW('PE2762313', 'Disan Baang Kiulu', 'activity', 'Team building', '2026-09-23', 15, 200, '2026-09-26 02:39:23'),
    ROW('PE2637555', 'Disan Baang Kiulu', 'activity', 'piknik', '2026-09-27', 84, 1503, '2026-09-28 05:36:34'),
    ROW('PE1570108', 'Disan Baang Kiulu', 'accommodation', 'chalet', '2026-10-03', 10, 226, '2026-10-04 00:13:33'),
    ROW('PE7554590', 'Dapako Hill - Lingga Eco Tourism', 'activity', 'Hiking', '2026-10-04', 12, 420, '2026-10-06 01:21:31'),
    ROW('PE0935444', 'Dapako Hill - Lingga Eco Tourism', 'activity', 'picnic', '2026-10-04', 30, 150, '2026-10-06 01:22:35'),
    ROW('PE5404371', 'Dapako Hill - Lingga Eco Tourism', 'activity', 'Sijil', '2026-10-04', 12, 60, '2026-10-06 01:24:33'),
    ROW('PE7543408', 'Murug Turug Eco Tourism', 'activity', 'Pakej A (Hiking)', '2026-10-11', 2, 52, '2026-10-11 05:30:40'),
    ROW('PE5283368', 'Murug Turug Eco Tourism', 'activity', 'Pakej B (Hiking)', '2026-10-11', 70, 1403, '2026-10-11 05:31:06'),
    ROW('PE0018808', 'Murug Turug Eco Tourism', 'activity', 'Pakej C (Hiking)', '2026-10-11', 18, 893, '2026-10-11 05:31:39'),
    ROW('PE7822655', 'Murug Turug Eco Tourism', 'activity', 'Pakej Ultra (Hiking)', '2026-10-11', 10, 520, '2026-10-11 05:32:01')
) AS n (receipt_id, company_name, booking_type, product, booking_date, pax, total_rm, created_old)
LEFT JOIN companies c ON c.company_name = n.company_name
LEFT JOIN bookings b
  ON b.company_id = c.id
 AND b.legacy_receipt_id IS NULL
 AND b.status <> 'cancelled'
 AND b.booking_type = n.booking_type
 AND ( (n.booking_type = 'activity'      AND DATE(b.activity_date) = n.booking_date)
    OR (n.booking_type = 'accommodation' AND b.check_in_date      = n.booking_date) )
ORDER BY FIELD(verdict, 'LIKELY DUPLICATE', 'possible - check', 'same day, different booking', 'no booking that day'),
         n.booking_date, n.receipt_id;
