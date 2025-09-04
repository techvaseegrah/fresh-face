'use client';

import React, { useState, useEffect } from 'react';

// Define the type for a single gift card for clarity
interface CustomerGiftCard {
  _id: string;
  uniqueCode: string;
  currentBalance: number;
  issueDate: string;
  expiryDate: string;
  giftCardTemplateId?: {
    name: string;
  };
}

interface CustomerGiftCardListProps {
  customerId: string | undefined;
}

const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
};

const CustomerGiftCardList: React.FC<CustomerGiftCardListProps> = ({ customerId }) => {
  const [activeGiftCards, setActiveGiftCards] = useState<CustomerGiftCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (customerId) {
        const fetchGiftCards = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`/api/customer/${customerId}/gift-cards`);
                if (response.ok) {
                    const data = await response.json();
                    setActiveGiftCards(data);
                } else {
                    // Handle non-ok responses if needed
                    setActiveGiftCards([]);
                }
            } catch (error) {
                console.error("Failed to fetch customer gift cards", error);
                setActiveGiftCards([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchGiftCards();
    } else {
        // If no customerId, clear the list and stop loading
        setActiveGiftCards([]);
        setIsLoading(false);
    }
  }, [customerId]); // This effect will re-run whenever the customerId prop changes

  if (isLoading) {
    return <p className="text-gray-500 mt-2 text-sm p-4">Loading gift cards...</p>;
  }

  return (
    <div className="mt-4 p-4 border-t">
      <h3 className="text-base font-semibold text-gray-700">Active Gift Cards</h3>
      
      {activeGiftCards.length > 0 ? (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeGiftCards.map(card => (
                  <div key={card._id} className="bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm">
                      <p className="text-sm font-bold text-blue-600">
                          NAME: {card.giftCardTemplateId?.name?.toUpperCase() || 'GIFT CARD'}
                      </p>
                      <p className="text-sm font-bold text-blue-600 mt-1">
                          NUMBER: {card.uniqueCode}
                      </p>
                      <div className="mt-4 text-xs text-gray-600 space-y-1 border-t pt-2">
                          <div className="flex justify-between"><span>Start Date:</span> <span>{formatDate(card.issueDate)}</span></div>
                          <div className="flex justify-between"><span>End Date:</span> <span>{formatDate(card.expiryDate)}</span></div>
                          <div className="flex justify-between font-bold text-sm text-gray-800 mt-1"><span>Balance:</span> <span>₹{card.currentBalance}</span></div>
                      </div>
                  </div>
              ))}
          </div>
      ) : (
          <p className="text-gray-500 mt-2 text-sm">This customer has no active gift cards.</p>
      )}
    </div>
  );
};

export default CustomerGiftCardList;