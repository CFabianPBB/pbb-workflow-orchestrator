// Configuration settings for the application
const config = {
  // API URLs
  apiUrls: {
    programInventory: process.env.REACT_APP_INVENTORY_API || "https://program-inventory.onrender.com/",
    costAllocation: process.env.REACT_APP_COSTING_API || "https://budget-allocation-app.onrender.com/",
    programScoring: process.env.REACT_APP_SCORING_API || "https://program-evaluation-predictor.onrender.com/",
    programInsight: process.env.REACT_APP_INSIGHTS_API || "https://program-insights-predictor.onrender.com/"
  },
  
  // API endpoints
  endpoints: {
    programInventory: "api/generate-inventory",
    costAllocation: "api/allocate-costs",
    programScoring: "api/evaluate-programs",
    programInsight: "api/generate-insights"
  },
  
  // File upload settings
  uploads: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedFileTypes: ['.xlsx', '.xls']
  }
};

export default config;
