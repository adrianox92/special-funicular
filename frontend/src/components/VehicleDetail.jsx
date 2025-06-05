import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Form, Button, Alert, Row, Col, Spinner } from 'react-bootstrap';
import axios from 'axios';

const imageFields = [
  { name: 'front', label: 'Delantera' },
  { name: 'left', label: 'Perfil Izquierdo' },
  { name: 'right', label: 'Perfil Derecho' },
  { name: 'rear', label: 'Trasera' },
  { name: 'top', label: 'Superior' },
  { name: 'chassis', label: 'Chasis' },
  { name: 'three_quarters', label: 'Vista 3/4' },
];

const VehicleDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState(null);
  const [images, setImages] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingImage, setDeletingImage] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`http://localhost:5001/api/vehicles/${id}`);
        setVehicle(res.data);
        const imgRes = await axios.get(`http://localhost:5001/api/vehicles/${id}/images`);
        const imgs = imgRes.data || [];
        const imagesObj = {};
        imgs.forEach(img => {
          imagesObj[img.view_type] = img.image_url;
        });
        setImages(imagesObj);
        setLoading(false);
      } catch {
        setError('Error al cargar el vehículo');
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleDeleteImage = async (viewType) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta imagen?')) {
      return;
    }

    setDeletingImage(viewType);
    try {
      await axios.delete(`http://localhost:5001/api/vehicles/${id}/images/${viewType}`);
      setImages(prev => {
        const newImages = { ...prev };
        delete newImages[viewType];
        return newImages;
      });
      const imgRes = await axios.get(`http://localhost:5001/api/vehicles/${id}/images`);
      const imgs = imgRes.data || [];
      const imagesObj = {};
      imgs.forEach(img => {
        imagesObj[img.view_type] = img.image_url;
      });
      setImages(imagesObj);
    } catch (err) {
      setError('Error al eliminar la imagen');
    } finally {
      setDeletingImage(null);
    }
  };

  if (loading) return <Spinner animation="border" />;
  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!vehicle) return null;

  return (
    <div className="mt-4">
      <h2>Detalle Vehículo</h2>
      <Form>
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Modelo</Form.Label>
              <Form.Control name="model" value={vehicle.model || ''} disabled readOnly />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Fabricante</Form.Label>
              <Form.Control name="manufacturer" value={vehicle.manufacturer || ''} disabled readOnly />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Tipo</Form.Label>
              <Form.Select name="type" value={vehicle.type || ''} disabled readOnly>
                <option value="">Selecciona tipo</option>
                <option>Rally</option>
                <option>GT</option>
                <option>LMP</option>
                <option>Clásico</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Tracción</Form.Label>
              <Form.Control name="traction" value={vehicle.traction || ''} disabled readOnly />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Precio original (€)</Form.Label>
              <Form.Control name="price" type="number" step="0.01" value={vehicle.price || ''} disabled readOnly />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Precio actual (€)</Form.Label>
              <Form.Control name="total_price" type="number" step="0.01" value={vehicle.total_price || ''} disabled readOnly />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Fecha de compra</Form.Label>
              <Form.Control name="purchase_date" type="date" value={vehicle.purchase_date ? vehicle.purchase_date.substring(0, 10) : ''} disabled readOnly />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Lugar de compra</Form.Label>
              <Form.Control name="purchase_place" value={vehicle.purchase_place || ''} disabled readOnly />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Check name="modified" label="Modificado" checked={!!vehicle.modified} disabled readOnly />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Check name="digital" label="Digital" checked={!!vehicle.digital} disabled readOnly />
            </Form.Group>
          </Col>
          <Col md={6}>
            <h5>Fotografías</h5>
            <Row>
              {imageFields.map(({ name, label }) => (
                <Col xs={6} md={6} className="mb-3" key={name}>
                  <Form.Label>{label} Imagen</Form.Label>
                  <div className="border rounded d-flex flex-column align-items-center justify-content-center p-2 position-relative" 
                       style={{ minHeight: 120, borderStyle: 'dashed', background: '#fff8f8' }}>
                    {images[name] ? (
                      <>
                        <img src={images[name]} alt={label} style={{ maxWidth: '100%', maxHeight: 90, objectFit: 'contain' }} />
                        <Button
                          variant="danger"
                          size="sm"
                          className="position-absolute top-0 end-0 m-1"
                          onClick={() => handleDeleteImage(name)}
                          disabled={deletingImage === name}
                        >
                          {deletingImage === name ? (
                            <Spinner animation="border" size="sm" />
                          ) : (
                            '×'
                          )}
                        </Button>
                      </>
                    ) : (
                      <span className="text-secondary">Imagen</span>
                    )}
                  </div>
                </Col>
              ))}
            </Row>
          </Col>
        </Row>
        <div className="d-flex justify-content-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => navigate('/vehicles')}>Volver al listado</Button>
          <Button as={Link} to={`/edit/${id}`} variant="primary">Editar</Button>
        </div>
      </Form>
    </div>
  );
};

export default VehicleDetail; 