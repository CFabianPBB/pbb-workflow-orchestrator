import axios from 'axios';
import config from '../config';

const apiService = {
  programInventory: {
    generateInventory: async (personnelFile, websiteUrl, orgName) => {
      const formData = new FormData();
      formData.append('file', personnelFile);
      formData.append('website_url', websiteUrl || '');
      formData.append('org_name', orgName);
      formData.append('programs_per_dept', '5'); // Default value
      
      const response = await axios.post(config.apiUrls.programInventory, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      return response.data;
    }
  },
  
  costAllocation: {
    allocateCosts: async (inventoryData, budgetFile, orgName) => {
      const formData = new FormData();
      formData.append('budget_file', budgetFile);
      formData.append('inventory_data', JSON.stringify(inventoryData));
      formData.append('org_name', orgName);
      
      const response = await axios.post(config.apiUrls.costAllocation, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      return response.data;
    }
  },
  
  programScoring: {
    evaluatePrograms: async (costData, orgName) => {
      const formData = new FormData();
      formData.append('cost_data', JSON.stringify(costData));
      formData.append('org_name', orgName);
      
      const response = await axios.post(config.apiUrls.programScoring, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      return response.data;
    }
  },
  
  programInsight: {
    generateInsights: async (scoringData, orgName) => {
      const formData = new FormData();
      formData.append('scoring_data', JSON.stringify(scoringData));
      formData.append('org_name', orgName);
      
      const response = await axios.post(config.apiUrls.programInsight, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      return response.data;
    }
  }
};

export default apiService;