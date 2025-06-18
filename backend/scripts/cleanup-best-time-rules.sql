-- Script para limpiar reglas de tipo best_time_per_round
-- Este script elimina las reglas que ya no son necesarias después de la migración

-- Eliminar reglas de competición con tipo best_time_per_round
DELETE FROM competition_rules 
WHERE rule_type = 'best_time_per_round' AND is_template = false;

-- Eliminar plantillas con tipo best_time_per_round
DELETE FROM competition_rules 
WHERE rule_type = 'best_time_per_round' AND is_template = true; 