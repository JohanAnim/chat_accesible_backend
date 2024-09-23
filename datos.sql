
-- mis datos para el chat de la base de datos en postgres

-- crear tabla de usuarios

CREATE TABLE usuarios(
	id SERIAL PRIMARY KEY,
	nombre VARCHAR(255) NOT NULL,
	email VARCHAR(255) NOT NULL,
	password VARCHAR(255) NOT NULL
);