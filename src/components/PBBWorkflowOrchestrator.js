import React, { useState } from 'react';
import { Upload, PlayCircle, CheckCircle, AlertCircle, Info, Download } from 'lucide-react';
import config from '../config';

const PBBWorkflowOrchestrator = () => {
  const appUrls = config.apiUrls;

  const [orgName, setOrgName] = useState('');
  const [files, setFiles] = useState({
    personnel: null,
    website: ''
  });
  const [isRunning, setIsRunning] = useState(false);
  const [agentStatus, setAgentStatus] = useState({
    programInventory: 'idle',
    costAllocation: 'idle',
    prioritization: 'idle',
    budgetOptimization: 'idle'
  });
  const [outputFiles, setOutputFiles] = useState({
    programInventory: null,
    costAllocation: null,
    prioritization: null,
    budgetOptimization: null
  });
  const [logs, setLogs] = useState([]);

  const addLog = (message) => {
    console.log(message);
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const StatusIcon = ({ status }) => {
    switch (status) {
      case 'running':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <div className="h-4 w-4 rounded-full bg-gray-300"></div>;
    }
  };

  const updateAgentStatus = (agent, status) => {
    setAgentStatus(prev => ({ ...prev, [agent]: status }));
  };

  const submitToApp = async (url, formData) => {
    try {
      console.log("🚀 Attempting direct connection to Render app...");
      
      // Try direct connection first (both apps on Render should communicate directly)
      console.log("🔄 Trying direct POST to:", url);
      console.log("📋 FormData contents before sending:");
      let hasFile = false;
      let hasWebsiteUrl = false;
      let hasProgramsPerDept = false;
      
      for (let [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log(`  ${key}: File(${value.name}, ${value.size} bytes, ${value.type})`);
          console.log(`    - Valid file: ${value.size > 0 && value.name.length > 0}`);
          console.log(`    - File extension: ${value.name.split('.').pop()}`);
          hasFile = value.size > 0 && value.name.length > 0;
        } else {
          console.log(`  ${key}: "${value}"`);
          if (key === 'website_url' && value && value.length > 0) hasWebsiteUrl = true;
          if (key === 'programs_per_department' && value) hasProgramsPerDept = true;
        }
      }
      
      console.log("🔍 Validation check:");
      console.log(`  - Has valid file: ${hasFile}`);
      console.log(`  - Has website URL: ${hasWebsiteUrl}`);
      console.log(`  - Has programs per department: ${hasProgramsPerDept}`);

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        mode: 'cors',
        credentials: 'include',
        redirect: 'manual' // Manually handle redirects
      });

      console.log("📥 Response details:");
      console.log("  - Status:", response.status);
      console.log("  - Status text:", response.statusText);
      console.log("  - Response URL:", response.url);

      // Handle redirects manually
      if (response.status === 302 || response.status === 301) {
        const location = response.headers.get('location');
        console.log("🔄 Direct redirect detected! Location:", location);
        
        if (location) {
          let fullRedirectUrl;
          if (location.startsWith('/')) {
            // Relative URL - construct full URL
            const baseUrl = new URL(url).origin;
            fullRedirectUrl = baseUrl + location;
          } else {
            fullRedirectUrl = location;
          }
          
          console.log("🔄 Following direct redirect to:", fullRedirectUrl);
          
          const redirectResponse = await fetch(fullRedirectUrl, {
            method: 'GET',
            mode: 'cors',
            credentials: 'include'
          });
          
          console.log("✅ Direct redirect followed successfully");
          return redirectResponse;
        }
      }

      if (response.status === 200) {
        console.log("✅ Direct POST successful");
        return response;
      }

      throw new Error(`Direct connection failed with status: ${response.status}`);

    } catch (error) {
      console.log("⚠️ Direct connection failed:", error.message);
      console.log("🔄 Falling back to proxy method...");
      
      // Fallback to proxy method
      const proxyUrl = 'https://api.allorigins.win/raw?url=';
      
      try {
        const response = await fetch(proxyUrl + encodeURIComponent(url), {
          method: 'POST',
          body: formData,
          mode: 'cors',
          credentials: 'omit'
        });
        
        console.log("✅ Proxy method successful");
        return response;
      } catch (proxyError) {
        console.log("❌ Both direct and proxy methods failed");
        throw new Error(`Both connection methods failed. Direct: ${error.message}, Proxy: ${proxyError.message}`);
      }
    }
  };

  const waitForProcessingComplete = async (taskUrl, maxWaitTime = 300000) => { // 5 minutes default
    console.log("⏳ Waiting for background processing to complete...");
    console.log("🔗 Task URL:", taskUrl);
    
    // Clean the task URL to remove any proxy wrapper
    let cleanTaskUrl = taskUrl.replace('https://api.allorigins.win/raw?url=', '');
    console.log("🔗 Clean Task URL:", cleanTaskUrl);
    
    const startTime = Date.now();
    const pollInterval = 3000; // 3 seconds
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        console.log("🔄 Checking task status...");
        
        // Try direct connection first
        let response;
        try {
          response = await fetch(cleanTaskUrl, {
            method: 'GET',
            mode: 'cors',
            credentials: 'include'
          });
        } catch (directError) {
          console.log("⚠️ Direct task check failed, using proxy...");
          const proxyUrl = 'https://api.allorigins.win/raw?url=';
          response = await fetch(proxyUrl + encodeURIComponent(cleanTaskUrl));
        }
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const html = await response.text();
        
        // Check if processing is complete
        if (response.url.includes('/download/') || html.includes('Download Excel File') || html.includes('Programs Generated Successfully')) {
          console.log("✅ Processing complete! Redirected to download page");
          return response;
        }
        
        // Check if still processing
        if (html.includes('Processing') || html.includes('please wait') || html.includes('background')) {
          console.log("🔄 Still processing... waiting");
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        }
        
        // Check for errors
        if (html.includes('Error') || html.includes('failed')) {
          console.log("❌ Processing failed");
          throw new Error('Background processing failed');
        }
        
        console.log("🔄 Status unclear, continuing to wait...");
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
      } catch (error) {
        console.log("❌ Error checking task status:", error.message);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }
    
    throw new Error('Timeout waiting for background processing to complete');
  };

  const handleFileUpload = (type, event) => {
    const file = event.target.files[0];
    if (file) {
      setFiles(prev => ({ ...prev, [type]: file }));
      addLog(`${type === 'personnel' ? 'Personnel' : 'Website'} file uploaded: ${file.name}`);
    }
  };

  const handleWebsiteUrlChange = (url) => {
    setFiles(prev => ({ ...prev, website: url }));
    addLog(`Website URL set: ${url}`);
  };

  const runWorkflow = async () => {
    if (!files.personnel || !orgName) {
      addLog('❌ Please upload personnel file and enter organization name');
      return;
    }

    setIsRunning(true);
    addLog('🚀 Starting PBB Workflow...');

    try {
      // Step 1: Program Inventory Agent
      addLog('📝 Step 1: Running Program Inventory Agent...');
      updateAgentStatus('programInventory', 'running');

      try {
        // Submit to Program Inventory app
        const inventoryFormData = new FormData();
        inventoryFormData.append('file', files.personnel);
        inventoryFormData.append('website_url', files.website || 'https://www.tempe.gov/government/city-clerk-s-office');
        inventoryFormData.append('programs_per_department', '5');

        console.log("🚀 Submitting to Program Inventory App...");
        const inventoryResponse = await submitToApp(appUrls.programInventory, inventoryFormData);
        
        console.log("📥 Program Inventory Response received");
        console.log("📥 Response status:", inventoryResponse.status);
        console.log("📥 Response URL:", inventoryResponse.url);
        
        // Clean any proxy URLs from initial response
        let cleanResponseUrl = inventoryResponse.url.replace('https://api.allorigins.win/raw?url=', '');
        console.log("🔗 Clean Response URL:", cleanResponseUrl);
        
        // Check response headers for location
        const locationHeader = inventoryResponse.headers.get('location');
        if (locationHeader) {
          console.log("🔗 Location header found:", locationHeader);
        }
        
        // Log all headers for debugging
        console.log("📥 All response headers:");
        for (let [key, value] of inventoryResponse.headers.entries()) {
          console.log(`  ${key}: ${value}`);
        }
        
        const responseText = await inventoryResponse.text();
        console.log("📄 Full response content (first 1000 chars):", responseText.substring(0, 1000));
        console.log("📄 Response contains '/task/':", responseText.includes('/task/'));
        console.log("📄 Response contains 'task':", responseText.includes('task'));
        
        // Look for task URL in multiple ways
        let taskUrl = null;
        
        // Method 1: Check if we're already on a task page
        if (cleanResponseUrl.includes('/task/')) {
          taskUrl = cleanResponseUrl;
          console.log("✅ Method 1: Already on task page:", taskUrl);
        }
        
        // Method 2: Look for task ID in response content (numeric task IDs)
        if (!taskUrl) {
          console.log("🔍 Searching for numeric task ID pattern...");
          const taskUrlMatch = responseText.match(/\/task\/(\d+)/);
          console.log("🔍 Regex match result:", taskUrlMatch);
          if (taskUrlMatch) {
            const baseUrl = new URL(appUrls.programInventory).origin;
            taskUrl = `${baseUrl}${taskUrlMatch[0]}`;
            console.log("✅ Method 2: Found numeric task URL in content:", taskUrl);
          } else {
            console.log("❌ Method 2: No numeric task URL found");
          }
        }
        
        // Method 3: Look for meta refresh or JavaScript redirect (numeric task IDs)
        if (!taskUrl) {
          const metaRefreshMatch = responseText.match(/url=([^"'>\s]+task\/\d+[^"'>\s]*)/);
          if (metaRefreshMatch) {
            taskUrl = metaRefreshMatch[1];
            if (taskUrl.startsWith('/')) {
              const baseUrl = new URL(appUrls.programInventory).origin;
              taskUrl = baseUrl + taskUrl;
            }
            console.log("✅ Method 3: Found numeric task URL in meta refresh:", taskUrl);
          }
        }

        let inventoryDownloadUrl = null;

        // If we found a task URL, use it for polling
        if (taskUrl) {
          console.log("🎯 Using task URL for polling:", taskUrl);
          
          try {
            // Wait for processing to complete using the correct task URL
            const finalResponse = await waitForProcessingComplete(taskUrl, 300000); // 5 minutes
            
            // Clean any proxy URLs from final response
            let cleanFinalUrl = finalResponse.url.replace('https://api.allorigins.win/raw?url=', '');
            console.log("🔗 Clean Final URL:", cleanFinalUrl);
            
            if (cleanFinalUrl.includes('/download/')) {
              console.log("✅ Processing complete! Redirected to download page");
              
              // Extract filename from download URL
              const filenameMatch = cleanFinalUrl.match(/\/download\/(.+)$/);
              if (filenameMatch) {
                const filename = filenameMatch[1];
                console.log("✅ Extracted filename from download URL:", filename);
                
                // Construct the get-file URL
                const baseUrl = new URL(cleanFinalUrl).origin;
                const getFileUrl = `${baseUrl}/get-file/${filename}`;
                console.log("✅ Constructed get-file URL:", getFileUrl);
                
                inventoryDownloadUrl = getFileUrl;
              }
            }
            
          } catch (taskError) {
            console.log("❌ Could not process using task URL:", taskError.message);
            updateAgentStatus('programInventory', 'error');
            addLog(`❌ Program Inventory Agent failed: Could not access task page`);
            return;
          }
        } else {
          console.log("⚠️ No task URL found, checking if already completed...");
          
          // Check if we reached the download page directly
          if (cleanResponseUrl.includes('/download/') || responseText.includes('Download Excel File') || responseText.includes('Programs Generated Successfully')) {
            console.log("✅ Processing completed immediately!");
            
            if (cleanResponseUrl.includes('/download/')) {
              // Extract filename from download URL
              const filenameMatch = cleanResponseUrl.match(/\/download\/(.+)$/);
              if (filenameMatch) {
                const filename = filenameMatch[1];
                console.log("✅ Extracted filename from download URL:", filename);
                
                // Construct the get-file URL
                const baseUrl = new URL(cleanResponseUrl).origin;
                const getFileUrl = `${baseUrl}/get-file/${filename}`;
                console.log("✅ Constructed get-file URL:", getFileUrl);
                
                inventoryDownloadUrl = getFileUrl;
              }
            } else {
              // Try to extract download URL from HTML content
              const downloadUrlMatch = responseText.match(/href="([^"]*get-file[^"]*\.xlsx)"/);
              if (downloadUrlMatch) {
                let extractedUrl = downloadUrlMatch[1];
                if (extractedUrl.startsWith('/')) {
                  const baseUrl = new URL(cleanResponseUrl).origin;
                  extractedUrl = baseUrl + extractedUrl;
                }
                console.log("✅ Extracted download URL from HTML:", extractedUrl);
                inventoryDownloadUrl = extractedUrl;
              }
            }
            
            if (!inventoryDownloadUrl) {
              console.log("🔗 Using clean response URL as download URL:", cleanResponseUrl);
              inventoryDownloadUrl = cleanResponseUrl;
            }
          } else {
            // Wait for background processing to complete
            console.log("🔄 Detected background processing, waiting for completion...");
            
            const finalResponse = await waitForProcessingComplete(cleanResponseUrl, 300000); // 5 minutes
            
            // Clean any proxy URLs from final response
            let cleanFinalUrl = finalResponse.url.replace('https://api.allorigins.win/raw?url=', '');
            console.log("🔗 Clean Final URL:", cleanFinalUrl);
            
            if (cleanFinalUrl.includes('/download/')) {
              console.log("✅ Processing complete! Redirected to download page");
              
              // Extract filename from download URL
              const filenameMatch = cleanFinalUrl.match(/\/download\/(.+)$/);
              if (filenameMatch) {
                const filename = filenameMatch[1];
                console.log("✅ Extracted filename from download URL:", filename);
                
                // Construct the get-file URL
                const baseUrl = new URL(cleanFinalUrl).origin;
                const getFileUrl = `${baseUrl}/get-file/${filename}`;
                console.log("✅ Constructed get-file URL:", getFileUrl);
                
                inventoryDownloadUrl = getFileUrl;
              }
            } else {
              const finalText = await finalResponse.text();
              
              // Check if the HTML contains any download links
              console.log("📄 Checking final response for download URLs...");
              console.log("📄 HTML contains 'get-file':", finalText.includes('get-file'));
              console.log("📄 HTML contains 'download':", finalText.includes('download'));
              console.log("📄 HTML contains 'Error':", finalText.includes('Error'));
              console.log("📄 HTML snippet:", finalText.substring(0, 500));
              
              const downloadUrlMatch = finalText.match(/href="([^"]*get-file[^"]*\.xlsx)"/);
              if (downloadUrlMatch) {
                let extractedUrl = downloadUrlMatch[1];
                if (extractedUrl.startsWith('/')) {
                  const baseUrl = new URL(cleanFinalUrl).origin;
                  extractedUrl = baseUrl + extractedUrl;
                }
                console.log("✅ Found get-file URL:", extractedUrl);
                inventoryDownloadUrl = extractedUrl;
              } else {
                console.log("❌ Could not find download URL in response");
                if (finalText.includes('Error') || finalText.includes('failed')) {
                  throw new Error('Program Inventory processing failed');
                } else {
                  console.log("❌ Redirected back to the original form - processing failed");
                  throw new Error('Background processing completed but no download found');
                }
              }
            }
          }
        }

        if (inventoryDownloadUrl) {
          console.log("✅ Program Inventory Download URL found:", inventoryDownloadUrl);
          updateAgentStatus('programInventory', 'completed');
          setOutputFiles(prev => ({
            ...prev,
            programInventory: { 
              downloadUrl: inventoryDownloadUrl,
              filename: 'Program_Inventory.xlsx'
            }
          }));
          addLog('✅ Program Inventory Agent completed successfully');
        } else {
          throw new Error('Could not find download URL in Program Inventory response');
        }

      } catch (inventoryError) {
        console.log("❌ Program Inventory Error:", inventoryError);
        updateAgentStatus('programInventory', 'error');
        addLog(`❌ Program Inventory Agent failed: ${inventoryError.message}`);
        return;
      }

      // Step 2: Cost Allocation Agent
      addLog('💰 Step 2: Running Cost Allocation Agent...');
      updateAgentStatus('costAllocation', 'running');

      try {
        const costFormData = new FormData();
        costFormData.append('file', files.personnel);

        const costResponse = await submitToApp(appUrls.costAllocation, costFormData);
        const costText = await costResponse.text();

        // Extract download URL for cost allocation
        const costDownloadMatch = costText.match(/href="([^"]*get-file[^"]*\.xlsx)"/);
        if (costDownloadMatch) {
          let costDownloadUrl = costDownloadMatch[1];
          if (costDownloadUrl.startsWith('/')) {
            const baseUrl = new URL(appUrls.costAllocation).origin;
            costDownloadUrl = baseUrl + costDownloadUrl;
          }

          updateAgentStatus('costAllocation', 'completed');
          setOutputFiles(prev => ({
            ...prev,
            costAllocation: { 
              downloadUrl: costDownloadUrl,
              filename: 'Cost_Allocation.xlsx'
            }
          }));
          addLog('✅ Cost Allocation Agent completed successfully');
        } else {
          throw new Error('Could not find download URL in Cost Allocation response');
        }

      } catch (costError) {
        console.log("❌ Cost Allocation Error:", costError);
        updateAgentStatus('costAllocation', 'error');
        addLog(`❌ Cost Allocation Agent failed: ${costError.message}`);
      }

      // Step 3: Prioritization Agent
      addLog('📊 Step 3: Running Prioritization Agent...');
      updateAgentStatus('prioritization', 'running');

      try {
        const prioritizationFormData = new FormData();
        prioritizationFormData.append('file', files.personnel);

        const prioritizationResponse = await submitToApp(appUrls.prioritization, prioritizationFormData);
        const prioritizationText = await prioritizationResponse.text();

        // Extract download URL for prioritization
        const prioritizationDownloadMatch = prioritizationText.match(/href="([^"]*get-file[^"]*\.xlsx)"/);
        if (prioritizationDownloadMatch) {
          let prioritizationDownloadUrl = prioritizationDownloadMatch[1];
          if (prioritizationDownloadUrl.startsWith('/')) {
            const baseUrl = new URL(appUrls.prioritization).origin;
            prioritizationDownloadUrl = baseUrl + prioritizationDownloadUrl;
          }

          updateAgentStatus('prioritization', 'completed');
          setOutputFiles(prev => ({
            ...prev,
            prioritization: { 
              downloadUrl: prioritizationDownloadUrl,
              filename: 'Prioritization_Analysis.xlsx'
            }
          }));
          addLog('✅ Prioritization Agent completed successfully');
        } else {
          throw new Error('Could not find download URL in Prioritization response');
        }

      } catch (prioritizationError) {
        console.log("❌ Prioritization Error:", prioritizationError);
        updateAgentStatus('prioritization', 'error');
        addLog(`❌ Prioritization Agent failed: ${prioritizationError.message}`);
      }

      // Step 4: Budget Optimization Agent
      addLog('🎯 Step 4: Running Budget Optimization Agent...');
      updateAgentStatus('budgetOptimization', 'running');

      try {
        const budgetFormData = new FormData();
        budgetFormData.append('file', files.personnel);

        const budgetResponse = await submitToApp(appUrls.budgetOptimization, budgetFormData);
        const budgetText = await budgetResponse.text();

        // Extract download URL for budget optimization
        const budgetDownloadMatch = budgetText.match(/href="([^"]*get-file[^"]*\.xlsx)"/);
        if (budgetDownloadMatch) {
          let budgetDownloadUrl = budgetDownloadMatch[1];
          if (budgetDownloadUrl.startsWith('/')) {
            const baseUrl = new URL(appUrls.budgetOptimization).origin;
            budgetDownloadUrl = baseUrl + budgetDownloadUrl;
          }

          updateAgentStatus('budgetOptimization', 'completed');
          setOutputFiles(prev => ({
            ...prev,
            budgetOptimization: { 
              downloadUrl: budgetDownloadUrl,
              filename: 'Budget_Optimization.xlsx'
            }
          }));
          addLog('✅ Budget Optimization Agent completed successfully');
        } else {
          throw new Error('Could not find download URL in Budget Optimization response');
        }

      } catch (budgetError) {
        console.log("❌ Budget Optimization Error:", budgetError);
        updateAgentStatus('budgetOptimization', 'error');
        addLog(`❌ Budget Optimization Agent failed: ${budgetError.message}`);
      }

      addLog('🎉 PBB Workflow completed!');

    } catch (error) {
      addLog(`❌ Workflow failed: ${error.message}`);
      console.error('Workflow error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">
              Priority-Based Budgeting Workflow Orchestrator
            </h1>
            <p className="text-lg text-gray-600">
              Automated AI-powered budget analysis and optimization for {orgName || 'your organization'}
            </p>
          </div>

          {/* Input Section */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Input Configuration</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Enter your organization name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Website URL (Optional)
                </label>
                <input
                  type="url"
                  value={files.website}
                  onChange={(e) => handleWebsiteUrlChange(e.target.value)}
                  placeholder="https://your-organization.gov"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Personnel Data File
                </label>
                <div className="flex items-center">
                  <input
                    type="file"
                    accept=".xlsx,.csv"
                    onChange={(e) => handleFileUpload('personnel', e)}
                    className="hidden"
                    id="personnel-upload"
                  />
                  <label
                    htmlFor="personnel-upload"
                    className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 cursor-pointer"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Personnel File
                  </label>
                  {files.personnel && (
                    <span className="ml-3 text-sm text-gray-600">
                      {files.personnel.name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={runWorkflow}
                disabled={!files.personnel || !orgName || isRunning}
                className="flex items-center px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <PlayCircle className="h-5 w-5 mr-2" />
                {isRunning ? 'Running Workflow...' : 'Run PBB Workflow'}
              </button>
            </div>
          </div>

          {/* Workflow Status */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Workflow Status</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-800">Program Inventory</h3>
                  <StatusIcon status={agentStatus.programInventory} />
                </div>
                <p className="text-sm text-gray-600">Analyze personnel data and generate program inventory</p>
                <div className="flex items-center">
                  <StatusIcon status={agentStatus.programInventory} />
                  {outputFiles.programInventory && (
                    <a 
                      href={outputFiles.programInventory.downloadUrl} 
                      download={outputFiles.programInventory.filename}
                      className="ml-2 flex items-center px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </a>
                  )}
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-800">Cost Allocation</h3>
                  <StatusIcon status={agentStatus.costAllocation} />
                </div>
                <p className="text-sm text-gray-600">Allocate personnel costs to programs</p>
                <div className="flex items-center">
                  <StatusIcon status={agentStatus.costAllocation} />
                  {outputFiles.costAllocation && (
                    <a 
                      href={outputFiles.costAllocation.downloadUrl} 
                      download={outputFiles.costAllocation.filename}
                      className="ml-2 flex items-center px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </a>
                  )}
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-800">Prioritization</h3>
                  <StatusIcon status={agentStatus.prioritization} />
                </div>
                <p className="text-sm text-gray-600">Analyze and rank program priorities</p>
                <div className="flex items-center">
                  <StatusIcon status={agentStatus.prioritization} />
                  {outputFiles.prioritization && (
                    <a 
                      href={outputFiles.prioritization.downloadUrl} 
                      download={outputFiles.prioritization.filename}
                      className="ml-2 flex items-center px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </a>
                  )}
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-800">Budget Optimization</h3>
                  <StatusIcon status={agentStatus.budgetOptimization} />
                </div>
                <p className="text-sm text-gray-600">Generate optimized budget recommendations</p>
                <div className="flex items-center">
                  <StatusIcon status={agentStatus.budgetOptimization} />
                  {outputFiles.budgetOptimization && (
                    <a 
                      href={outputFiles.budgetOptimization.downloadUrl} 
                      download={outputFiles.budgetOptimization.filename}
                      className="ml-2 flex items-center px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Execution Log */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Execution Log</h2>
            <div className="bg-black text-green-400 p-4 rounded-md h-64 overflow-y-auto font-mono text-sm">
              {logs.length === 0 ? (
                <div className="text-gray-500">Ready to run workflow...</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="mb-1">{log}</div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PBBWorkflowOrchestrator;