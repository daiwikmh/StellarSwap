import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router';
import LandingPage from './components/landing/landing';
import DashboardPage from './components/dashboard/dashboard/page';

const App: React.FC = () => {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<LandingPage />} /> 
                <Route path="/dashboard" element={<DashboardPage/>} />
            </Routes>
        </Router>
    );
};

export default App;