-- ============================================================
-- 006: Seed de socios reales de AILE
-- ============================================================
-- Datos extraídos del formulario de voluntarios (hoja actualizada)
-- Se insertan SIN usuario_id (se vinculará cuando cada socio
-- se registre en el sistema con su email)
-- Se excluye a López Labrin Lautaro (ya creado en migración 004)
-- Cima Crucet Franca incluida con DNI temporal 'PENDIENTE-44' (completar luego)
-- ============================================================

INSERT INTO socios (nombre, apellido, dni, email, telefono, estado, rol, rol_aile, fecha_ingreso, tiene_deuda)
VALUES
  -- ===================== BLOQUE 1 (Oct 2022) =====================
  -- #1 Tesorero → admin
  ('Fausto', 'Lavezzari', '42344364', 'faustolavezzari99@gmail.com', '3489535199', 'activo', 'admin', 'Tesorero', '2022-10-30', false),

  -- #2 Comunicación (miembro) → socio
  ('Hannah', 'Altamirano', '43605581', 'hannahaltamirano1@gmail.com', '3541213003', 'activo', 'socio', 'Comunicación', '2022-10-30', false),

  -- #3 Secretaria General → admin
  ('Vera', 'Lopez Avalle', '42783499', 'veraile2024@gmail.com', '3541306212', 'activo', 'admin', 'Secretaria General', '2022-10-30', false),

  -- #4 Comunicación (miembro) → socio
  ('Lara', 'Vargas Calderón', '42787396', 'vargas.calderon.lara@gmail.com', '3541531509', 'activo', 'socio', 'Comunicación', '2022-10-30', false),

  -- #5 Vocal → comision_directiva
  ('Matias', 'Marchesin Kossoy', '42891055', 'matimarchesinkossoy@gmail.com', '3541236732', 'activo', 'comision_directiva', 'Vocal', '2022-10-30', false),

  -- #6 CEA (miembro) → socio
  ('José Valentín', 'Paz', '42387375', 'valentinpaz@live.com', '3541332208', 'activo', 'socio', 'CEA', '2022-10-30', false),

  -- #7 López Labrin Lautaro → EXCLUIDO (ya en migración 004)

  -- #8 Director de Comunicación → comision_directiva
  ('Emiliano Nicolás', 'Aguad', '43812368', 'emiagugames@gmail.com', '3512527353', 'activo', 'comision_directiva', 'Director de Comunicación', '2022-10-31', false),

  -- #9 SIN DIRECCIÓN → socio
  ('Gabriel Agustín', 'Garcia', '45155955', 'gabrielgarciaimportantes@gmail.com', '3515109675', 'activo', 'socio', NULL, '2022-10-30', false),

  -- #10 Vocal → comision_directiva
  ('Camila Micaela', 'De Angelis', '43230152', 'camideangelispriv@gmail.com', '3541352937', 'activo', 'comision_directiva', 'Vocal', '2022-10-31', false),

  -- #11 Directora de RRHH → comision_directiva
  ('Constanza', 'Rossi', '45690200', 'cotyaile@gmail.com', '3513778965', 'activo', 'comision_directiva', 'Directora de RRHH', '2022-10-31', false),

  -- #12 Revisora de Cuentas Suplente → revisor_cuentas
  ('Mayla', 'Bird', '43605546', 'maylabird123@gmail.com', '3541332673', 'activo', 'revisor_cuentas', 'Revisora de Cuentas Suplente', '2022-10-31', false),

  -- ===================== BLOQUE 2 (Nov 2022 - Dic 2023) =====================
  -- #13 Director de CEA → comision_directiva
  ('Juan Manuel', 'Philippeaux', '46034263', 'juanmaphilippeaux@gmail.com', '3513265062', 'activo', 'comision_directiva', 'Director de CEA', '2022-11-02', false),

  -- #14 SIN DIRECCIÓN → socio
  ('Felipe', 'Binimelis Panero', '43603512', 'feliguille44@gmail.com', '3512006835', 'activo', 'socio', NULL, '2022-11-03', false),

  -- #15 SIN DIRECCIÓN → socio
  ('Nevi Gabriela', 'Orrego Ferraris', '45932037', 'neviorregogabriela@gmail.com', '3541216643', 'activo', 'socio', NULL, '2023-04-24', false),

  -- #16 Director de Finanzas → comision_directiva
  ('Ignacio', 'Alcedo', '46034415', 'nachoalcedo@gmail.com', '3512637242', 'activo', 'comision_directiva', 'Director de Finanzas', '2023-05-29', false),

  -- #17 SIN DIRECCIÓN → socio
  ('Santiago', 'Ardiles', '43926217', 'ardilessantiago3@gmail.com', '3513813567', 'activo', 'socio', NULL, '2023-11-29', false),

  -- #18 Finanzas (miembro) → socio
  ('Joaquín', 'Carcano', '46036542', 'joaquincarcano2@gmail.com', '3541672653', 'activo', 'socio', 'Finanzas', '2023-12-04', false),

  -- ===================== BLOQUE 3 (Ene - Sep 2024) =====================
  -- #19 Parlamentaria CEA → comision_directiva
  ('Brisa Ludmila', 'Pittuelli', '46591914', 'ludmipittuelli@gmail.com', '3541580896', 'activo', 'comision_directiva', 'Parlamentaria CEA', '2024-01-21', false),

  -- #20 Comunicación (miembro) → socio
  ('Nicolas', 'Pereyra', '46848523', 'nicopereyra286@gmail.com', '3541389754', 'activo', 'socio', 'Comunicación', '2024-01-21', false),

  -- #21 Finanzas (miembro) → socio
  ('Lucía', 'Figueroa', '45697526', 'luciafigueroacl@gmail.com', '3541554243', 'activo', 'socio', 'Finanzas', '2024-05-11', false),

  -- #22 RRHH (miembro) → socio
  ('María Milagros', 'Soler Conde', '43603615', 'milagrossolerconde16@gmail.com', '3541595895', 'activo', 'socio', 'RRHH', '2024-08-03', false),

  -- #23 Finanzas (miembro) → socio
  ('Lucas', 'Alessandria Korol', '45936145', 'lucasalessandria123@gmail.com', '3541229341', 'activo', 'socio', 'Finanzas', '2024-09-30', false),

  -- ===================== BLOQUE 4 (Ene - May 2025) =====================
  -- #24 RRHH (miembro) → socio
  ('Guadalupe', 'Gonzalez', '47668813', 'guadaa.gonzalez4766@gmail.com', '3517365600', 'activo', 'socio', 'RRHH', '2025-01-19', false),

  -- #25 RRHH (miembro) → socio
  ('Lucas Naim', 'Casales', '46505606', 'lucasnaimc@gmail.com', '3512013237', 'activo', 'socio', 'RRHH', '2025-01-19', false),

  -- #26 Comunicación (miembro) → socio
  ('Alina', 'Parra Arribas', '47785474', 'parraarribasalina@gmail.com', '3541699813', 'activo', 'socio', 'Comunicación', '2025-03-02', false),

  -- #27 Comunicación (miembro) → socio
  ('Nahir', 'Abatte', '46592050', 'naiiabatte@gmail.com', '3541657565', 'activo', 'socio', 'Comunicación', '2025-05-27', false),

  -- ===================== BLOQUE 5 (Nov 2025 - Feb 2026) - SIN DIRECCIÓN =====================
  -- #28
  ('Agustina', 'Córdoba', '45487636', 'aguscba2904@gmail.com', '3513744661', 'activo', 'socio', NULL, '2025-11-25', false),

  -- #29
  ('Luciano', 'Atienza', '48068416', 'luciano.atienza26@gmail.com', '3518680687', 'activo', 'socio', NULL, '2025-11-25', false),

  -- #30
  ('Facundo', 'Fernández', '46125944', 'facufernandez100@gmail.com', '3512528635', 'activo', 'socio', NULL, '2025-11-25', false),

  -- #31
  ('Francisco', 'Rocchia', '48671684', 'franciscorocchia@gmail.com', '3541221485', 'activo', 'socio', NULL, '2025-11-25', false),

  -- #32
  ('Marlene', 'González Capella', '48253443', 'margonz1588@gmail.com', '3424855552', 'activo', 'socio', NULL, '2025-11-25', false),

  -- #33
  ('Alexander Nicolás', 'Tscherkasow', '94920689', 'tscherkasowalexander@gmail.com', '3512337679', 'activo', 'socio', NULL, '2025-11-25', false),

  -- #34
  ('Milagros', 'Peters', '48328478', 'milipp0912@gmail.com', '3543642212', 'activo', 'socio', NULL, '2025-11-29', false),

  -- #35
  ('Maria', 'Juarez Paz', '46972204', 'pazmariajuarez5@gmail.com', '3513824422', 'activo', 'socio', NULL, '2025-11-29', false),

  -- #36
  ('Santiago', 'Molina', '48331325', 'molinasantiago2008@gmail.com', '3513535772', 'activo', 'socio', NULL, '2025-11-29', false),

  -- #37
  ('Martina', 'Mancilla', '48126033', 'maassrtimancilla7@gmail.com', '3518589492', 'activo', 'socio', NULL, '2025-11-29', false),

  -- #38
  ('Benjamin', 'Valussi', '47712211', 'bbenjav1@gmail.com', '3516881201', 'activo', 'socio', NULL, '2025-11-29', false),

  -- #39
  ('Mia', 'Colombo', '48671607', 'si123456789qa@gmail.com', '3541396495', 'activo', 'socio', NULL, '2025-11-29', false),

  -- #40
  ('Julieta Martina', 'Bravo', '48671625', 'bravojuli25@gmail.com', '3541379869', 'activo', 'socio', NULL, '2025-11-29', false),

  -- #41
  ('María Elena', 'Alemany', '47265513', 'alemanymariaelena07@gmail.com', '3517386856', 'activo', 'socio', NULL, '2025-11-29', false),

  -- #42
  ('Elías', 'Villalba', '47575223', 'eliasvillalbaarg@gmail.com', '3517695408', 'activo', 'socio', NULL, '2025-12-06', false),

  -- #43
  ('Antonella Nicole', 'Zavala Zamora', '48597985', 'antonellanicole35@gmail.com', '3517507609', 'activo', 'socio', NULL, '2025-12-06', false),

  -- #44 Datos incompletos - completar luego
  ('Franca', 'Cima Crucet', 'PENDIENTE-44', NULL, NULL, 'activo', 'socio', NULL, '2026-02-01', false)

ON CONFLICT (dni) DO NOTHING;
