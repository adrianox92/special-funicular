import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Button, Alert, Row, Col,Container } from 'react-bootstrap';
import api from '../lib/axios';

const imageFields = [
  { name: 'front', label: 'Delantera' },
  { name: 'left', label: 'Perfil Izquierdo' },
  { name: 'right', label: 'Perfil Derecho' },
  { name: 'rear', label: 'Trasera' },
  { name: 'top', label: 'Superior' },
  { name: 'chassis', label: 'Chasis' },
  { name: 'three_quarters', label: 'Vista 3/4' },
];

const AddVehicle = () => {
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState({
    model: '',
    manufacturer: '',
    type: '',
    traction: '',
    price: '',
    total_price: '',
    purchase_date: '',
    purchase_place: '',
    modified: false,
    digital: false,
  });
  const [images, setImages] = useState({});
  const [previews, setPreviews] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setVehicle({
      ...vehicle,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleImageChange = (e, field) => {
    const file = e.target.files[0];
    setImages({ ...images, [field]: file });
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews(prev => ({ ...prev, [field]: reader.result }));
      };
      reader.readAsDataURL(file);
    } else {
      setPreviews(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      Object.entries(vehicle).forEach(([key, value]) => formData.append(key, value));
      imageFields.forEach(({ name }) => {
        if (images[name]) {
          formData.append('images', images[name], name);
        }
      });
      await api.post('/vehicles', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      navigate('/vehicles');
    } catch (error) {
      console.error('Error al crear vehículo:', error);
      setError('Error al crear el vehículo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mt-4">
      <h2>Añadir Vehículo</h2>
      <Form onSubmit={handleSubmit}>
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Modelo</Form.Label>
              <Form.Control name="model" value={vehicle.model} onChange={handleChange} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Fabricante</Form.Label>
              <Form.Control name="manufacturer" value={vehicle.manufacturer} onChange={handleChange} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Tipo</Form.Label>
              <Form.Select name="type" value={vehicle.type} onChange={handleChange} required>
                <option value="">Selecciona tipo</option>
                <option>Rally</option>
                <option>GT</option>
                <option>LMP</option>
                <option>Clásico</option>
                <option>DTM</option>
                <option>F1</option>
                <option>Camiones</option>
                <option>Raid</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Tracción</Form.Label>
              <Form.Control name="traction" value={vehicle.traction} onChange={handleChange} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Precio original (€)</Form.Label>
              <Form.Control name="price" type="number" step="0.01" value={vehicle.price} onChange={handleChange} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Fecha de compra</Form.Label>
              <Form.Control name="purchase_date" type="date" value={vehicle.purchase_date} onChange={handleChange} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Lugar de compra</Form.Label>
              <Form.Control name="purchase_place" value={vehicle.purchase_place} onChange={handleChange} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Check name="modified" label="Modificado" checked={vehicle.modified} onChange={handleChange} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Check name="digital" label="Digital" checked={vehicle.digital} onChange={handleChange} />
            </Form.Group>
          </Col>
          <Col md={6}>
            <h5>Fotografías</h5>
            <Row>
              {imageFields.map(({ name, label }) => (
                <Col xs={6} md={6} className="mb-3" key={name}>
                  <Form.Label>{label} Imagen</Form.Label>
                  <div className="border rounded d-flex flex-column align-items-center justify-content-center p-2" style={{ minHeight: 120, borderStyle: 'dashed', cursor: 'pointer', background: '#fff8f8' }} onClick={() => document.getElementById(`img-${name}`).click()}>
                    {previews[name] ? (
                      <img src={previews[name]} alt={label} style={{ maxWidth: '100%', maxHeight: 90, objectFit: 'contain' }} />
                    ) : (
                      <span className="text-secondary">Imagen</span>
                    )}
                    <input
                      id={`img-${name}`}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={e => handleImageChange(e, name)}
                    />
                  </div>
                </Col>
              ))}
            </Row>
          </Col>
        </Row>
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="d-flex justify-content-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => navigate('/vehicles')}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Crear Vehículo'}</Button>
        </div>
      </Form>
    </div>
  );
};

export default AddVehicle; 