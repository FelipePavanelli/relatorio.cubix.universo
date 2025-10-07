import React, { useState, useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';

interface DataLoadedNotificationProps {
  onClose?: () => void;
  autoHide?: boolean;
  autoHideDelay?: number;
}

const DataLoadedNotification: React.FC<DataLoadedNotificationProps> = ({
  onClose,
  autoHide = true,
  autoHideDelay = 3000
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (autoHide) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose?.(), 300); // Aguarda animação de saída
      }, autoHideDelay);

      return () => clearTimeout(timer);
    }
  }, [autoHide, autoHideDelay, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose?.(), 300);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 shadow-lg max-w-sm">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-green-800">
              Relatório Carregado!
            </h3>
            <p className="text-sm text-green-700 mt-1">
              Seus dados foram processados e o relatório está pronto para visualização.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="flex-shrink-0 text-green-400 hover:text-green-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataLoadedNotification;

