const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;


const getAuthToken = () => {
    return localStorage.getItem("auth_token"); // Obtener el token almacenado
};

const apiRequest = async (endpoint, method = "GET", body = null) => {
    const token = getAuthToken();
    //const token = "1|3yw3OnKzFKEcTrEu1JYPCrAqMLgxM9Hcqpx5l6aEd26d405f"

    const headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const options = {
        method,
        headers,
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE_URL}/${endpoint}`, options);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Error en la petición");
        }

        return data;
    } catch (error) {
        console.error("API Error:", error.message);
        throw error;
    }
};

export default apiRequest;
