-- Payroll extension schema untuk MySQL
-- Jalankan setelah `backend/schema.sql`

CREATE TABLE IF NOT EXISTS payroll_components (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  type ENUM('earning', 'deduction') NOT NULL,
  taxable TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_salary_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  effective_date DATE NOT NULL,
  base_salary BIGINT NOT NULL,
  payment_method ENUM('bank_transfer', 'cash') NOT NULL DEFAULT 'bank_transfer',
  bank_name VARCHAR(100) NULL,
  bank_account_name VARCHAR(150) NULL,
  bank_account_number VARCHAR(50) NULL,
  tax_profile_id INT NULL,
  bpjs_profile_id INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS employee_salary_component_values (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salary_profile_id INT NOT NULL,
  component_id INT NOT NULL,
  amount BIGINT NOT NULL DEFAULT 0,
  is_percentage TINYINT(1) NOT NULL DEFAULT 0,
  percentage_value DECIMAL(8,2) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (salary_profile_id) REFERENCES employee_salary_profiles(id),
  FOREIGN KEY (component_id) REFERENCES payroll_components(id)
);

CREATE TABLE IF NOT EXISTS payroll_variable_inputs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  period_month DATE NOT NULL,
  input_type ENUM('overtime', 'bonus', 'reimbursement', 'manual_adjustment') NOT NULL,
  amount BIGINT NOT NULL,
  description TEXT NULL,
  source_ref VARCHAR(100) NULL,
  approval_status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  created_by INT NULL,
  approved_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  period_month DATE NOT NULL,
  status ENUM('draft', 'reviewed', 'approved', 'finalized', 'published') NOT NULL DEFAULT 'draft',
  employee_count INT NOT NULL DEFAULT 0,
  total_gross BIGINT NOT NULL DEFAULT 0,
  total_deduction BIGINT NOT NULL DEFAULT 0,
  total_net BIGINT NOT NULL DEFAULT 0,
  created_by INT NULL,
  approved_by INT NULL,
  finalized_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  finalized_at DATETIME NULL
);

CREATE TABLE IF NOT EXISTS payroll_run_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payroll_run_id INT NOT NULL,
  employee_id INT NOT NULL,
  gross_amount BIGINT NOT NULL DEFAULT 0,
  deduction_amount BIGINT NOT NULL DEFAULT 0,
  net_amount BIGINT NOT NULL DEFAULT 0,
  tax_amount BIGINT NOT NULL DEFAULT 0,
  bpjs_amount BIGINT NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id),
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS payroll_run_item_components (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payroll_run_item_id INT NOT NULL,
  component_id INT NULL,
  component_name_snapshot VARCHAR(100) NOT NULL,
  component_type ENUM('earning', 'deduction') NOT NULL,
  amount BIGINT NOT NULL,
  calculation_meta JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payroll_run_item_id) REFERENCES payroll_run_items(id),
  FOREIGN KEY (component_id) REFERENCES payroll_components(id)
);

CREATE TABLE IF NOT EXISTS payroll_approvals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payroll_run_id INT NOT NULL,
  approval_level INT NOT NULL,
  approver_user_id INT NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  comment TEXT NULL,
  approved_at DATETIME NULL,
  FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id)
);

CREATE TABLE IF NOT EXISTS payroll_audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payroll_run_id INT NULL,
  actor_user_id INT NOT NULL,
  action VARCHAR(80) NOT NULL,
  before_data JSON NULL,
  after_data JSON NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id)
);
