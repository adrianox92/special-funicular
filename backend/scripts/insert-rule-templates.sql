-- Script para insertar plantillas de reglas de ejemplo
-- Ejecutar después de que se hayan añadido las nuevas columnas a la tabla competition_rules

-- Plantilla 1: Sistema de puntos estándar (1º=10, 2º=8, 3º=6, 4º=4, 5º=2)
INSERT INTO competition_rules (
    name,
    description,
    rule_type,
    points_structure,
    is_template,
    use_bonus_best_lap,
    created_at
) VALUES (
    'Sistema Estándar',
    'Sistema de puntos clásico: 1º=10, 2º=8, 3º=6, 4º=4, 5º=2 puntos por ronda',
    'per_round',
    '{"1": 10, "2": 8, "3": 6, "4": 4, "5": 2}',
    true,
    false,
    NOW()
);

-- Plantilla 2: Sistema de puntos F1 (1º=25, 2º=18, 3º=15, 4º=12, 5º=10, 6º=8, 7º=6, 8º=4, 9º=2, 10º=1)
INSERT INTO competition_rules (
    name,
    description,
    rule_type,
    points_structure,
    is_template,
    use_bonus_best_lap,
    created_at
) VALUES (
    'Sistema F1',
    'Sistema de puntos inspirado en la Fórmula 1: 1º=25, 2º=18, 3º=15, 4º=12, 5º=10, 6º=8, 7º=6, 8º=4, 9º=2, 10º=1',
    'per_round',
    '{"1": 25, "2": 18, "3": 15, "4": 12, "5": 10, "6": 8, "7": 6, "8": 4, "9": 2, "10": 1}',
    true,
    false,
    NOW()
);

-- Plantilla 3: Sistema simple (1º=3, 2º=2, 3º=1)
INSERT INTO competition_rules (
    name,
    description,
    rule_type,
    points_structure,
    is_template,
    use_bonus_best_lap,
    created_at
) VALUES (
    'Sistema Simple',
    'Sistema de puntos básico: 1º=3, 2º=2, 3º=1 puntos por ronda',
    'per_round',
    '{"1": 3, "2": 2, "3": 1}',
    true,
    false,
    NOW()
);

-- Plantilla 4: Sistema con bonus de mejor vuelta
INSERT INTO competition_rules (
    name,
    description,
    rule_type,
    points_structure,
    is_template,
    use_bonus_best_lap,
    created_at
) VALUES (
    'Sistema con Bonus',
    'Sistema estándar con 1 punto extra por mejor vuelta de la ronda',
    'per_round',
    '{"1": 10, "2": 8, "3": 6, "4": 4, "5": 2}',
    true,
    true,
    NOW()
);

-- Plantilla 5: Puntuación final (para el ganador general)
INSERT INTO competition_rules (
    name,
    description,
    rule_type,
    points_structure,
    is_template,
    use_bonus_best_lap,
    created_at
) VALUES (
    'Puntuación Final',
    'Puntos adicionales para la clasificación final: 1º=50, 2º=30, 3º=20, 4º=15, 5º=10',
    'final',
    '{"1": 50, "2": 30, "3": 20, "4": 15, "5": 10}',
    true,
    false,
    NOW()
);

-- Plantilla 6: Sistema de eliminación
INSERT INTO competition_rules (
    name,
    description,
    rule_type,
    points_structure,
    is_template,
    use_bonus_best_lap,
    created_at
) VALUES (
    'Sistema de Eliminación',
    'Solo puntúan los primeros 3: 1º=5, 2º=3, 3º=1 puntos por ronda',
    'per_round',
    '{"1": 5, "2": 3, "3": 1}',
    true,
    false,
    NOW()
);

-- Plantilla 7: Sistema de puntos extendido
INSERT INTO competition_rules (
    name,
    description,
    rule_type,
    points_structure,
    is_template,
    use_bonus_best_lap,
    created_at
) VALUES (
    'Sistema Extendido',
    'Sistema para competiciones grandes: 1º=15, 2º=12, 3º=10, 4º=8, 5º=6, 6º=4, 7º=2, 8º=1',
    'per_round',
    '{"1": 15, "2": 12, "3": 10, "4": 8, "5": 6, "6": 4, "7": 2, "8": 1}',
    true,
    false,
    NOW()
); 