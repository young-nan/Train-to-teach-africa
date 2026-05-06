-- =============================================================================
-- supabase/seed/0001_dev_seed.sql
-- One school, one teacher, two classes, ~50 pupils. For local + staging only.
-- DO NOT RUN AGAINST PRODUCTION. There's a guard at the top.
-- =============================================================================
--
-- To apply against staging:
--   psql "$STAGING_DB_URL" -f supabase/seed/0001_dev_seed.sql
--
-- Or via the Supabase SQL editor: paste the file contents and click "Run".
--
-- The pupils' names are realistic Nigerian names — Yoruba, Igbo, Hausa,
-- Edo, mixed. Photos are NULL (avatars render initials, which is fine
-- for testing). Pupil codes follow the pattern from the SIMS:
--   {first-name-uppercase}-{class-code}.
-- =============================================================================

-- Safety guard: if schools already has rows, abort. Prevents accidental
-- seeding into a real production database.
do $$
begin
  if (select count(*) from public.schools) > 0 then
    raise exception 'Database already has school rows. Refusing to seed. Run on a fresh staging DB.';
  end if;
end $$;

-- ---- School -----------------------------------------------------------------
insert into public.schools (id, name, slug, city, state, country, phone, status)
values (
  '00000000-0000-4000-a000-000000000001',
  'TLF Lekki',
  'tlf-lekki',
  'Lagos',
  'Lagos',
  'Nigeria',
  '+234 800 000 0001',
  'active'
);

-- ---- Classes ----------------------------------------------------------------
-- Two classes so the picker actually has something to pick from.
-- (Class teacher_id is filled in below after we know the teacher's auth.users.id.)
insert into public.classes (id, school_id, name, level, pupil_count) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000001', 'Primary 3 Emerald', 'primary_3', 28),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000001', 'Primary 4 Sapphire', 'primary_4', 22);

-- ---- Pupils — Primary 3 Emerald (28) ---------------------------------------
insert into public.pupils (school_id, class_id, full_name, level, pupil_code, date_of_birth) values
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', 'Adaeze Okafor', 'primary_3', 'ADAEZE-3E', '2018-03-12'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', 'Bukola Adesanya', 'primary_3', 'BUKOLA-3E', '2018-05-04'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', 'Chiamaka Eze', 'primary_3', 'CHIAMAKA-3E', '2018-09-21'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', 'David Adeleke', 'primary_3', 'DAVID-3E', '2018-11-15'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', 'Ebele Nwankwo', 'primary_3', 'EBELE-3E', '2018-02-28'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', 'Fatima Bello', 'primary_3', 'FATIMA-3E', '2018-07-08'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', 'Gbemi Ogunleye', 'primary_3', 'GBEMI-3E', '2018-04-19'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', 'Hadiza Mohammed', 'primary_3', 'HADIZA-3E', '2018-08-30'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', 'Ifeanyi Okoro', 'primary_3', 'IFEANYI-3E', '2018-01-25'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', 'Jadesola Akintola', 'primary_3', 'JADESOLA-3E', '2018-06-11'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', 'Kelechi Anyanwu', 'primary_3', 'KELECHI-3E', '2018-10-03'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', 'Lara Bankole', 'primary_3', 'LARA-3E', '2018-12-22'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', 'Maryam Suleiman', 'primary_3', 'MARYAM-3E', '2018-05-14'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', 'Nnamdi Obi', 'primary_3', 'NNAMDI-3E', '2018-09-07'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', 'Olamide Adeoye', 'primary_3', 'OLAMIDE-3E', '2018-03-29'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', 'Precious Igwe', 'primary_3', 'PRECIOUS-3E', '2018-07-23'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', 'Quadri Lawal', 'primary_3', 'QUADRI-3E', '2018-11-01'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', 'Rashidat Yusuf', 'primary_3', 'RASHIDAT-3E', '2018-02-17'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', 'Samuel Onyema', 'primary_3', 'SAMUEL-3E', '2018-04-06'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', 'Tomiwa Falade', 'primary_3', 'TOMIWA-3E', '2018-08-15'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', 'Uchenna Okeke', 'primary_3', 'UCHENNA-3E', '2018-12-09'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', 'Victoria Adeyemi', 'primary_3', 'VICTORIA-3E', '2018-06-27'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', 'Wasiu Ibrahim', 'primary_3', 'WASIU-3E', '2018-10-31'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', 'Yetunde Salami', 'primary_3', 'YETUNDE-3E', '2018-01-13'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', 'Zainab Garba', 'primary_3', 'ZAINAB-3E', '2018-05-25'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', 'Ade Williams', 'primary_3', 'ADEWILL-3E', '2018-09-18'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', 'Bashir Aliyu', 'primary_3', 'BASHIR-3E', '2018-03-04'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', 'Chinedu Okafor', 'primary_3', 'CHINEDU-3E', '2018-07-12');

-- ---- Pupils — Primary 4 Sapphire (22) --------------------------------------
insert into public.pupils (school_id, class_id, full_name, level, pupil_code, date_of_birth) values
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000002', 'Aisha Mohammed', 'primary_4', 'AISHA-4S', '2017-04-08'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000002', 'Bayo Ogunleye', 'primary_4', 'BAYO-4S', '2017-08-22'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000002', 'Chinwe Nwosu', 'primary_4', 'CHINWE-4S', '2017-01-15'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000002', 'Damilola Akande', 'primary_4', 'DAMILOLA-4S', '2017-06-30'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000002', 'Emeka Iwu', 'primary_4', 'EMEKA-4S', '2017-11-12'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000002', 'Funke Adebayo', 'primary_4', 'FUNKE-4S', '2017-02-05'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000002', 'Garba Hassan', 'primary_4', 'GARBA-4S', '2017-09-19'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000002', 'Halima Sani', 'primary_4', 'HALIMA-4S', '2017-05-26'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000002', 'Ikenna Eze', 'primary_4', 'IKENNA-4S', '2017-12-03'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000002', 'Jumoke Adeleke', 'primary_4', 'JUMOKE-4S', '2017-03-17'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000002', 'Kemi Olatunji', 'primary_4', 'KEMI-4S', '2017-07-28'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000002', 'Lukman Bello', 'primary_4', 'LUKMAN-4S', '2017-10-09'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000002', 'Mariam Aliyu', 'primary_4', 'MARIAM-4S', '2017-04-21'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000002', 'Ngozi Anya', 'primary_4', 'NGOZI-4S', '2017-08-14'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000002', 'Obinna Okeke', 'primary_4', 'OBINNA-4S', '2017-01-02'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000002', 'Patricia Okoro', 'primary_4', 'PATRICIA-4S', '2017-06-15'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000002', 'Ridwan Yakubu', 'primary_4', 'RIDWAN-4S', '2017-11-24'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000002', 'Seun Ajayi', 'primary_4', 'SEUN-4S', '2017-02-11'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000002', 'Tobi Aderemi', 'primary_4', 'TOBI-4S', '2017-09-06'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000002', 'Usman Lawal', 'primary_4', 'USMAN-4S', '2017-05-19'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000002', 'Victor Nnaji', 'primary_4', 'VICTOR-4S', '2017-12-30'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000002', 'Yusuf Ibrahim', 'primary_4', 'YUSUF-4S', '2017-03-08');

-- =============================================================================
-- AFTER SEEDING — manual step
-- =============================================================================
-- Sign up a teacher account through the app (e.g. teacher@tlf-lekki.test).
-- Then run this in the SQL editor, replacing <USER_ID> with that auth.users.id:
--
--   update public.profiles
--      set role = 'teacher', school_id = '00000000-0000-4000-a000-000000000001'
--    where user_id = '<USER_ID>';
--
--   update public.classes
--      set teacher_id = '<USER_ID>'
--    where school_id = '00000000-0000-4000-a000-000000000001';
--
-- Now the teacher will see Primary 3 Emerald and Primary 4 Sapphire in
-- the class picker, with all the seeded pupils inside.
-- =============================================================================
