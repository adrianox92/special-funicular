import React, { useEffect, useRef } from 'react';
import { Card, Badge, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { FaDownload, FaTrash, FaCalendarAlt, FaMapMarkerAlt } from 'react-icons/fa';
import api from '../lib/axios';
import placeholderImage from '../assets/images/placeholder.png';
import './VehicleCard.css';

const VehicleCard = ({ vehicle, onDelete }) => {
  const navigate = useNavigate();
  const imgRef = useRef(null);

  useEffect(() => {
    if (imgRef.current) {
      let timeoutId;
      const resizeObserver = new ResizeObserver(entries => {
        if (timeoutId) {
          cancelAnimationFrame(timeoutId);
        }
        
        timeoutId = requestAnimationFrame(() => {
          if (!Array.isArray(entries) || !entries.length) {
            return;
          }
        });
      });

      resizeObserver.observe(imgRef.current);
      return () => {
        if (timeoutId) {
          cancelAnimationFrame(timeoutId);
        }
        resizeObserver.disconnect();
      };
    }
  }, []);

  const handleDelete = async (e) => {
    e.stopPropagation();
    
    if (window.confirm('¿Estás seguro de que quieres eliminar este vehículo? Esta acción no se puede deshacer.')) {
      try {
        await api.delete(`/vehicles/${vehicle.id}`);
        if (onDelete) {
          onDelete(vehicle.id);
        }
      } catch (error) {
        console.error('Error al eliminar vehículo:', error);
        alert('Error al eliminar el vehículo');
      }
    }
  };

  const handleDownloadSpecs = async (e) => {
    e.stopPropagation();
    try {
      const response = await api.get(`/vehicles/${vehicle.id}/specs-pdf`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ficha-tecnica-${vehicle.model.toLowerCase().replace(/\s+/g, '-')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error al descargar la ficha técnica:', error);
      alert('Error al descargar la ficha técnica');
    }
  };

  return (
    <Card
      className="vehicle-card mb-4"
      onClick={() => navigate(`/vehicles/${vehicle.id}`)}
    >
      {vehicle.modified && (
        <Badge bg="dark" className="position-absolute top-0 start-0 m-2">
          Modificado
        </Badge>
      )}
      
      <div className="position-absolute top-0 end-0 m-2 d-flex gap-1">
        <Button
          variant="primary"
          size="sm"
          onClick={handleDownloadSpecs}
          title="Descargar ficha técnica"
        >
          <FaDownload />
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={handleDelete}
          title="Eliminar vehículo"
        >
          <FaTrash />
        </Button>
      </div>
      
      <Card.Img
        ref={imgRef}
        variant="top"
        src={vehicle.image || placeholderImage}
        alt={vehicle.model}
        loading="lazy"
      />
      
      <Card.Body>
        <Card.Title className="card-title">{vehicle.model}</Card.Title>
        
        <div className="manufacturer-info">
          {vehicle.manufacturer}
          {vehicle.reference && (
            <span className="reference"> - {vehicle.reference}</span>
          )}
        </div>
        
        <div className="mb-3">
          <Badge bg="secondary" className="me-2">{vehicle.type}</Badge>
          <Badge bg="secondary">{vehicle.traction}</Badge>
        </div>
        
        <div className="price-container">
          {vehicle.total_price !== undefined && vehicle.total_price !== null && vehicle.total_price !== vehicle.price ? (
            <>
              {vehicle.price && (
                <>
                  <span className="original-price">€{Number(vehicle.price).toFixed(2)}</span>
                  <span className="total-price">€{Number(vehicle.total_price).toFixed(2)}</span>
                  {vehicle.price > 0 && (
                    <span className="price-increment">
                      (+{((vehicle.total_price - vehicle.price) / vehicle.price * 100).toFixed(1)}%)
                    </span>
                  )}
                </>
              )}
            </>
          ) : (
            vehicle.price && <span className="single-price">€{Number(vehicle.price).toFixed(2)}</span>
          )}
        </div>
        
        <div className="purchase-info">
          <div className="purchase-date">
            <FaCalendarAlt />
            <span>{new Date(vehicle.purchase_date).toLocaleDateString()}</span>
          </div>
          {vehicle.purchase_place && (
            <div className="purchase-place">
              <FaMapMarkerAlt />
              <span>{vehicle.purchase_place}</span>
            </div>
          )}
        </div>
      </Card.Body>
    </Card>
  );
};

export default VehicleCard;
