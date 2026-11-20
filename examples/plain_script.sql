-- Plain SQL script: must stay built-in SQL in Zed
SELECT e.employee_id, e.name, d.department_name
  FROM employees e
  JOIN departments d ON e.department_id = d.department_id
 WHERE e.salary > 5000
 ORDER BY e.name;

UPDATE employees SET salary = salary * 1.05 WHERE department_id = 10;
