import React, { useState, useEffect } from 'react';
import { 
  Card, Button, Badge, Modal, Form, Alert, ListGroup, ListGroupItem,
  Spinner, Row, Col 
} from 'react-bootstrap';
import { 
  FaTags, FaPlus, FaEdit, FaTrash, FaExclamationTriangle
} from 'react-icons/fa';
import axios from '../lib/axios';

const CompetitionCategories = ({ competitionId, onCategoryChange }) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  
  // Estados para el modal
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: ''
  });

  // Cargar categorías
  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/competitions/${competitionId}/categories`);
      setCategories(response.data);
      setError(null);
    } catch (err) {
      console.error('Error al cargar categorías:', err);
      setError('Error al cargar las categorías');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [competitionId]);

  // Abrir modal para crear/editar
  const openModal = (category = null) => {
    setEditingCategory(category);
    setFormData({
      name: category ? category.name : ''
    });
    setShowModal(true);
    setSaveError(null);
  };

  // Guardar categoría
  const handleSave = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setSaveError('El nombre de la categoría es requerido');
      return;
    }

    try {
      setSaving(true);
      setSaveError(null);
      
      if (editingCategory) {
        // Actualizar categoría existente
        await axios.put(`/competitions/${competitionId}/categories/${editingCategory.id}`, formData);
      } else {
        // Crear nueva categoría
        await axios.post(`/competitions/${competitionId}/categories`, formData);
      }
      
      setShowModal(false);
      setEditingCategory(null);
      setFormData({ name: '' });
      
      // Recargar categorías y notificar al componente padre
      loadCategories();
      if (onCategoryChange) {
        onCategoryChange();
      }
    } catch (err) {
      console.error('Error al guardar categoría:', err);
      setSaveError(err.response?.data?.error || 'Error al guardar la categoría');
    } finally {
      setSaving(false);
    }
  };

  // Eliminar categoría
  const handleDelete = async (categoryId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta categoría? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await axios.delete(`/competitions/${competitionId}/categories/${categoryId}`);
      loadCategories();
      if (onCategoryChange) {
        onCategoryChange();
      }
    } catch (err) {
      console.error('Error al eliminar categoría:', err);
      alert('Error al eliminar la categoría');
    }
  };

  if (loading) {
    return (
      <Card>
        <Card.Header>
          <h6 className="mb-0 d-flex align-items-center gap-2">
            <FaTags /> Categorías
          </h6>
        </Card.Header>
        <Card.Body className="text-center py-4">
          <Spinner animation="border" size="sm">
            <span className="visually-hidden">Cargando...</span>
          </Spinner>
          <p className="mt-2 mb-0">Cargando categorías...</p>
        </Card.Body>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h6 className="mb-0 d-flex align-items-center gap-2">
            <FaTags /> Categorías ({categories.length})
          </h6>
          <Button
            variant="primary"
            size="sm"
            onClick={() => openModal()}
            className="d-flex align-items-center gap-1"
          >
            <FaPlus /> Añadir
          </Button>
        </Card.Header>
        <Card.Body>
          {error && (
            <Alert variant="danger" className="mb-3">
              {error}
            </Alert>
          )}

          {categories.length === 0 ? (
            <div className="text-center py-4">
              <FaTags size={32} className="text-muted mb-3" />
              <p className="text-muted mb-3">No hay categorías definidas</p>
              <Button
                variant="outline-primary"
                size="sm"
                onClick={() => openModal()}
                className="d-flex align-items-center gap-1 mx-auto"
              >
                <FaPlus /> Crear Primera Categoría
              </Button>
            </div>
          ) : (
            <ListGroup variant="flush">
              {categories.map((category) => (
                <ListGroupItem key={category.id} className="px-0 d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center gap-2">
                    <Badge bg="info" className="me-2">
                      {category.name}
                    </Badge>
                  </div>
                  <div className="d-flex gap-1">
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => openModal(category)}
                      className="d-flex align-items-center gap-1"
                    >
                      <FaEdit />
                    </Button>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleDelete(category.id)}
                      className="d-flex align-items-center gap-1"
                    >
                      <FaTrash />
                    </Button>
                  </div>
                </ListGroupItem>
              ))}
            </ListGroup>
          )}
        </Card.Body>
      </Card>

      {/* Modal para crear/editar categoría */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaTags className="me-2" />
            {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSave}>
          <Modal.Body>
            {saveError && (
              <Alert variant="danger" className="mb-3">
                {saveError}
              </Alert>
            )}

            <Form.Group>
              <Form.Label>Nombre de la categoría</Form.Label>
              <Form.Control
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: F1, GT, Rally, Clásicos..."
                required
              />
              <Form.Text className="text-muted">
                Define una categoría para agrupar participantes similares
              </Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              variant="primary"
              disabled={saving}
              className="d-flex align-items-center gap-2"
            >
              {saving ? (
                <>
                  <Spinner animation="border" size="sm" />
                  Guardando...
                </>
              ) : (
                <>
                  <FaPlus /> {editingCategory ? 'Actualizar' : 'Crear'}
                </>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
};

export default CompetitionCategories; 