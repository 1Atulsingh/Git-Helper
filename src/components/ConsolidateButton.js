// ConsolidateButton.js - Add to src/components directory

import React from 'react';
import styled from 'styled-components';

const StyledConsolidateButton = styled.button`
  background: linear-gradient(to bottom, #8957e5, #7046c1);
  color: white;
  border: none;
  padding: 8px 14px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 0.3px;
  margin-right: 12px;
  
  &:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(137, 87, 229, 0.4);
  }
  
  &:hover {
    background: linear-gradient(to bottom, #9a6ff0, #8957e5);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
  
  &:active {
    transform: translateY(1px);
  }
  
  &::before {
    content: '🔄 ';
    margin-right: 6px;
  }
`;

const ConsolidateButton = ({ onClick }) => {
  return (
    <StyledConsolidateButton onClick={onClick}>
      Consolidate Repos
    </StyledConsolidateButton>
  );
};

export default ConsolidateButton;
