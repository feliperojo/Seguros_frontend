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
      html: `
        <p>Este proceso marcará <strong>todas las coberturas activas</strong> como canceladas.</p>
        <p>Se usará la fecha <strong>${fechaCancelacion}</strong> como cancelación y retiro.</p>
        <div class="form-check mt-3 text-start">
          <input class="form-check-input" type="checkbox" id="checkbox_renovar_polizas" />
          <label class="form-check-label fw-semibold" for="checkbox_renovar_polizas">
            Deseo renovar automáticamente las pólizas canceladas
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
        const checkbox = document.getElementById("checkbox_renovar_polizas");
        return { renovar: checkbox.checked };
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

      if (result.value.renovar) {
        const gruposRenovados = listaCancelada.map(group => {
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
              id: `${member.id}-renovado-${Date.now()}`,
              ano_cobertura: String((parseInt(member.ano_cobertura) || new Date().getFullYear()))
            }));

          return {
            ...group,
            members: [...group.members, ...nuevosMiembros]
          };
        });

        setCoverageGroups(gruposRenovados);

        Swal.fire({
          icon: "success",
          title: "Cancelación y renovación completadas",
          text: "Las coberturas fueron canceladas y nuevas coberturas vacías han sido generadas.",
          timer: 4000,
          showConfirmButton: false
        });
      } else {
        setCoverageGroups(listaCancelada);

        Swal.fire({
          icon: "success",
          title: "Cancelación completada",
          text: "Las coberturas activas fueron canceladas correctamente.",
          timer: 3000,
          showConfirmButton: false
        });
      }

      onComplete(); // Limpia el estado trigger
    });
  }, [trigger]);

  return null;
};

export default RenovacionCoberturas;
