import { useEffect } from "react";
import Swal from "sweetalert2";

const RenovacionCoberturas = ({
  trigger = false,
  coverageGroups = [],
  setCoverageGroups = () => {},
  fechaCancelacion = "",
  onComplete = () => {}
}) => {
  useEffect(() => {
    if (!trigger || !coverageGroups.length || !fechaCancelacion) return;

    Swal.fire({
      title: "¿Estás seguro?",
      // Reemplaza la parte del HTML del modal con esto:
html: `
<p>Este proceso marcará <strong>todas las coberturas activas</strong> como canceladas.</p>
<p>Se usará la fecha <strong>${fechaCancelacion}</strong> como cancelación y retiro.</p>
<div class="form-check mt-3 text-start">
  <input class="form-check-input" type="radio" name="tipo_renovacion" id="renovar_vacio" value="vacio" checked />
  <label class="form-check-label fw-semibold" for="renovar_vacio">
    Renovar con tarjetas vacías (sólo nombres)
  </label>
</div>
<div class="form-check text-start">
  <input class="form-check-input" type="radio" name="tipo_renovacion" id="renovar_copia" value="copia" />
  <label class="form-check-label fw-semibold" for="renovar_copia">
    Renovar copiando datos de pólizas canceladas
  </label>
</div>
<p class="text-danger fw-bold mt-3">Esta acción no se puede deshacer.</p>
`,

      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, cancelar",
      cancelButtonText: "No",
      customClass: {
        confirmButton: 'btn btn-danger me-2',
        cancelButton: 'btn btn-secondary',
        actions: 'd-flex justify-content-center gap-2'
      },
      preConfirm: () => {
        const tipoSeleccionado = document.querySelector('input[name="tipo_renovacion"]:checked');
        if (!tipoSeleccionado) {
          Swal.showValidationMessage('Debes seleccionar un tipo de renovación');
          return false;
        }
        return { tipo: tipoSeleccionado.value };
      },
      
      buttonsStyling: false
    }).then((result) => {
      if (!result.isConfirmed) {
        onComplete(); // Limpia trigger sin hacer cambios
        return;
      }

      const listaCancelada = coverageGroups.map(group => ({
        ...group,
        members: group.members.map(member => {
          const debeCancelar =
            member.activo &&
            (member.estado_cobertura === "Yes" || (member.fecha_cancelacion && !member.fecha_retiro));

          if (!debeCancelar) return member;

          return {
            ...member,
            estado_cobertura: "No",
            fecha_cancelacion: fechaCancelacion,
            fecha_retiro: fechaCancelacion,
            activo: false,
            vigente: false,
            nota_cancel: "Cancelación general aplicada"
          };
        })
      }));

      if (result.value.tipo === "copia") {
        // Copiar datos
        const gruposRenovados = listaCancelada.map(group => {
          const nuevosMiembros = group.members
            .filter(member => !member.activo && member.fecha_cancelacion)
            .map(member => ({
              ...member,
              cobertura_id: null,
              cliente_id: member.cliente_id || member.id, 
              codigo_poliza: member.codigo_poliza,
              fecha_activacion: "", // vacía
              fecha_cancelacion: "",
              fecha_retiro: "",
              activo: true,
              vigente: true,
              id: `${member.id}-renovado-${Date.now()}`,
              nota_cancel: "",
              tipo_renovacion: "copiada"
              // deja otros campos como plan, metal, red, precio, etc.
            }));
      
          return {
            ...group,
            members: [...group.members, ...nuevosMiembros]
          };
        });
      
        setCoverageGroups(gruposRenovados);
      
        Swal.fire({
          icon: "success",
          title: "Renovación completada con datos copiados",
          text: "Se copiaron los datos anteriores para permitir edición rápida.",
          timer: 4000,
          showConfirmButton: false
        });
      }
      else if (result.value.tipo === "vacio") {
        // Lógica actual de renovación vacía
        const gruposVacios = listaCancelada.map(group => {
          const nuevosMiembros = group.members
            .filter(member => !member.activo && member.fecha_cancelacion)
            .map(member => ({
              ...member,
              cobertura_id: null,
              cliente_id: member.cliente_id || member.id,
              codigo_poliza: "",
              fecha_activacion: "",
              fecha_cancelacion: "",
              fecha_retiro: "",
              compania_id: "",
              plan: "",
              metal: "",
              red: "",
              precio: 0,
              estado_cobertura: "",
              elegibilidad: "",
              activo: true,
              vigente: true,
              nota_cancel: "",
              id: `${member.id}-vacio-${Date.now()}`,
              ano_cobertura: String((parseInt(member.ano_cobertura) || new Date().getFullYear())),
              tipo_renovacion: "vacia"
            }));
      
          return {
            ...group,
            members: [...group.members, ...nuevosMiembros]
          };
        });
      
        setCoverageGroups(gruposVacios);
      
        Swal.fire({
          icon: "success",
          title: "Renovación con tarjetas vacías",
          text: "Las coberturas fueron renovadas sin datos.",
          timer: 4000,
          showConfirmButton: false
        });
      }
      

      onComplete(); // Limpia el estado trigger
    });
  }, [trigger]);

  return null;
};

export default RenovacionCoberturas;
