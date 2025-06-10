// PathConfigurator.js - Add to src/components directory

import React from 'react';
import styled from 'styled-components';

const Container = styled.div`
  margin-bottom: 20px;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #f0f6fc;
`;

const Input = styled.input`
  width: 100%;
  padding: 10px 12px;
  border-radius: 6px;
  background-color: #21262d;
  color: #c9d1d9;
  border: 1px solid #30363d;
  font-size: 14px;
  transition: all 0.2s ease;
  
  &:hover, &:focus {
    border-color: #58a6ff;
    outline: none;
  }
`;

const HelperText = styled.p`
  margin-top: 6px;
  font-size: 12px;
  color: #8b949e;
`;

const ErrorText = styled.p`
  margin-top: 6px;
  font-size: 12px;
  color: #f85149;
`;

const PathConfigurator = ({ 
  label, 
  path, 
  onChange, 
  helperText,
  error,
  placeholder = "Enter target path (e.g., 'docs/imported')"
}) => {
  return (
    <Container>
      <Label>{label}</Label>
      <Input 
        type="text"
        value={path}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {helperText && !error && <HelperText>{helperText}</HelperText>}
      {error && <ErrorText>{error}</ErrorText>}
    </Container>
  );
};

export default PathConfigurator;
