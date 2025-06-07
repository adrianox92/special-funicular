import React, { useEffect, useRef } from 'react';
import { Card, Badge, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import { FiDownload } from 'react-icons/fi';
import placeholderImage from '../assets/images/placeholder.png';

// Estilos personalizados
const styles = {
  percentageText: {
    fontSize: '0.75rem',
    opacity: 0.8
  },
  cardHover: {
    transition: 'all 0.3s ease',
    '&:hover': {
      transform: 'translateY(-5px)',
      boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
    }
  }
};

const VehicleCard = ({ vehicle, onDelete }) => {
  const navigate = useNavigate();
  const imgRef = useRef(null);

  useEffect(() => {
    if (imgRef.current) {
      let timeoutId;
      const resizeObserver = new ResizeObserver(entries => {
        // Cancelar el timeout anterior si existe
        if (timeoutId) {
          cancelAnimationFrame(timeoutId);
        }
        
        // Usar requestAnimationFrame para limitar las actualizaciones
        timeoutId = requestAnimationFrame(() => {
          if (!Array.isArray(entries) || !entries.length) {
            return;
          }
          // Aquí podríamos hacer algo con el tamaño si fuera necesario
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
    e.stopPropagation(); // Evita que se active el onClick del Card
    
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
    e.stopPropagation(); // Evita que se active el onClick del Card
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
      className="mb-4 shadow-sm position-relative"
      style={{ 
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-5px)',
          boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
        }
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-5px)';
        e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 0.125rem 0.25rem rgba(0,0,0,0.075)';
      }}
      onClick={() => navigate(`/vehicles/${vehicle.id}`)}
    >
      {vehicle.modified && (
        <Badge bg="dark" className="position-absolute top-0 start-0 m-2">Modificado</Badge>
      )}
      <div className="position-absolute top-0 end-0 m-2 d-flex gap-1">
        <Button
          variant="primary"
          size="sm"
          onClick={handleDownloadSpecs}
          title="Descargar ficha técnica"
        >
          <FiDownload />
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={handleDelete}
          title="Eliminar vehículo"
        >
          🗑️
        </Button>
      </div>
      <Card.Img
        ref={imgRef}
        variant="top"
        src={vehicle.image || placeholderImage}
        alt={vehicle.model}
        style={{ height: '200px', objectFit: 'cover' }}
        loading="lazy"
      />
      <Card.Body>
        <Card.Title>{vehicle.model}</Card.Title>
        <div className="mb-2">
          {vehicle.manufacturer}
          {vehicle.reference && (
            <span className="text-muted"> - {vehicle.reference}</span>
          )}
        </div>
        <div className="mb-2">
          <Badge bg="secondary" className="me-2">{vehicle.type}</Badge>
          <Badge bg="secondary">{vehicle.traction}</Badge>
        </div>
        <div>
          {vehicle.total_price !== undefined && vehicle.total_price !== null && vehicle.total_price !== vehicle.price ? (
            <>
              {vehicle.price && (
                <>
                  <span className="text-muted text-decoration-line-through me-2">€{Number(vehicle.price).toFixed(2)}</span>
                  <span className="text-danger fw-bold">€{Number(vehicle.total_price).toFixed(2)}</span>
                  {vehicle.price > 0 && (
                    <span className="ms-2 text-danger" style={styles.percentageText}>
                      (+{((vehicle.total_price - vehicle.price) / vehicle.price * 100).toFixed(1)}%)
                    </span>
                  )}
                </>
              )}
            </>
          ) : (
            vehicle.price && <span className="fw-bold">€{Number(vehicle.price).toFixed(2)}</span>
          )}
        </div>
        <div className="text-muted">
          <small>📅 {new Date(vehicle.purchase_date).toLocaleDateString()}</small>
          {vehicle.purchase_place && (
            <>
              <br />
              <small>📍 {vehicle.purchase_place}</small>
            </>
          )}
        </div>
      </Card.Body>
    </Card>
  );
};

export default VehicleCard;
