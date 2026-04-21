INSERT INTO roles(name) VALUES
('Super Admin'),
('HRD'),
('Finance'),
('Manager'),
('Employee')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO departments(name) VALUES
('Engineering'),
('HRD'),
('Finance'),
('Marketing'),
('Operations')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO positions(name) VALUES
('Software Engineer'),
('HR Specialist'),
('Payroll Analyst'),
('Marketing Lead'),
('Data Analyst')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO employees(name, department_id, position_id, contract_end) VALUES
('Aditia Pratama', 1, 1, '2027-12-31'),
('Nadia Putri', 2, 2, '2028-06-30'),
('Rizky Maulana', 3, 3, '2027-11-30'),
('Salsa Wijaya', 4, 4, '2026-12-31')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Password default: admin123 (bcrypt hash)
INSERT INTO users(nik, password, role_id) VALUES
('ADM001', '$2b$10$2Y8uPaG8pBSGyd7fwqcLbOY67TEKq/qjvlUr9XwJG0DP4I92G1.rW', (SELECT id FROM roles WHERE name='HRD'))
ON DUPLICATE KEY UPDATE
  password = VALUES(password),
  role_id = VALUES(role_id);
