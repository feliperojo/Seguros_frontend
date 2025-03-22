import React, { useState } from "react";
import Select from "react-select";
import countryCodes from "../services/countryCodes";

// Muestra bandera + nombre
const formatOptionLabel = ({ country, code, iso }) => (
  <div className="flex items-center gap-2">
    <img
      src={`https://flagcdn.com/w20/${iso}.png`} // tamaño reducido
      alt={country}
      className="w-5 h-3 object-cover"
    />
    <span style={{ fontSize: "14px" }}>{country} (+{code})</span>
  </div>
);

// Personalizar altura del select
const customStyles = {
  control: (base) => ({
    ...base,
    minHeight: "38px", // altura como los inputs
    height: "38px",
    fontSize: "14px"
  }),
  indicatorsContainer: (base) => ({
    ...base,
    height: "38px"
  }),
  dropdownIndicator: (base) => ({
    ...base,
    padding: "4px"
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "0 8px"
  }),
  menu: (base) => ({
    ...base,
    zIndex: 9999 // para evitar que quede detrás de modales u otros elementos
  })
};

const CountrySelectWithFlags = ({ selectedCode, onChange, name }) => {
  const selectedOption = countryCodes.find((c) => c.iso === selectedCode) || countryCodes[0];

  return (
    <Select
      options={countryCodes}
      getOptionLabel={(e) => `${e.country} (+${e.code})`}
      getOptionValue={(e) => e.iso}
      formatOptionLabel={({ country, code, iso }) => (
        <div className="d-flex align-items-center gap-2">
          <img src={`https://flagcdn.com/w20/${iso}.png`} alt={country} className="me-2" />
          {country} (+{code})
        </div>
      )}
      value={selectedOption}
      onChange={(option) => onChange(name, option.iso)}
      styles={{
        control: (base) => ({
          ...base,
          minHeight: "38px",
          height: "38px",
          fontSize: "14px"
        }),
        dropdownIndicator: (base) => ({
          ...base,
          padding: "4px"
        }),
        valueContainer: (base) => ({
          ...base,
          padding: "0 8px"
        }),
        menu: (base) => ({
          ...base,
          zIndex: 9999
        })
      }}
    />
  );
};

export default CountrySelectWithFlags;

