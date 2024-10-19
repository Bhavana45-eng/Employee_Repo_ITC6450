const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const dotenv = require('dotenv');
dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// Serve static files (index.html) from the public folder
app.use(express.static('public'));

// Initialize Firestore
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://firestore.googleapis.com/v1/projects/${process.env.GCLOUD_PROJECT || 'trusty-slate-438814-f8'}/databases/(default)`
});

const db = admin.firestore();

// Route to add an employee
app.post('/api/employees', async (req, res) => {
  const { name, email, phone, position } = req.body;
  try {
    const docRef = await db.collection('Employee').add({ name, email, phone, position });
    res.status(200).json({ message: 'Employee added successfully', id: docRef.id });
  } catch (error) {
    res.status(500).json({ message: 'Error adding employee', error: error.message });
  }
});

// Route to get employees with pagination, sorting, and search
app.get('/api/employees', async (req, res) => {
  const { page = 1, limit = 5, sortBy = 'name', sortDirection = 'asc', search = '' } = req.query;
  try {
    const snapshot = await db.collection('Employee').get();
    let employees = [];

    // Filter employees by search criteria
    snapshot.forEach(doc => {
      const employee = { id: doc.id, ...doc.data() };
      if (employee.name.toLowerCase().includes(search.toLowerCase()) || 
          employee.email.toLowerCase().includes(search.toLowerCase())) {
        employees.push(employee);
      }
    });

    // Sort employees based on the selected field and direction
    employees.sort((a, b) => {
      if (sortDirection === 'asc') {
        return a[sortBy].localeCompare(b[sortBy]);
      } else {
        return b[sortBy].localeCompare(a[sortBy]);
      }
    });

    // Paginate the results
    const startIndex = (page - 1) * limit;
    const paginatedEmployees = employees.slice(startIndex, startIndex + Number(limit));

    res.status(200).json({
      total: employees.length,
      employees: paginatedEmployees
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ message: 'Error fetching employees', error: error.message });
  }
});

// Route to update an employee
app.put('/api/employees/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, position } = req.body;
  try {
    const employeeRef = db.collection('Employee').doc(id);
    await employeeRef.update({ name, email, phone, position });
    res.status(200).json({ message: 'Employee updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating employee', error: error.message });
  }
});

// Route to delete an employee
app.delete('/api/employees/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.collection('Employee').doc(id).delete();
    res.status(200).json({ message: 'Employee deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting employee', error: error.message });
  }
});

// Route to export all employees to CSV
app.get('/api/employees/export', async (req, res) => {
  try {
    const snapshot = await db.collection('Employee').get();
    let csv = 'Name,Email,Phone,Position\n';
    snapshot.forEach(doc => {
      const { name, email, phone, position } = doc.data();
      csv += `${name},${email},${phone},${position}\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=employees.csv');
    res.status(200).send(csv);
  } catch (error) {
    console.error('Error exporting employees to CSV:', error);
    res.status(500).json({ message: 'Error exporting employees to CSV', error: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
