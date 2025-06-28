import React, { useState } from 'react';
import { Upload, PlayCircle, CheckCircle, AlertCircle, Info, Download } from 'lucide-react';
import config from '../config';

const PBBWorkflowOrchestrator = () => {
  const appUrls = config.apiUrls;

  const [orgName, setOrgName] = useState('');
  const [files, setFiles] = useState({
    personnel: null,
    website: '',
    departmentBudget: null
  });
  const [currentStep, setCurrentStep] = useState(0);
  const [agentStatus, setAgentStatus] = useState({
    programInventory: 'idle',
    costAllocation: 'idle',
    programScoring: 'idle',
    programInsight: 'idle'
  });
  const [outputFiles, setOutputFiles] = useState({
    programInventory: null,
    costAllocation: null,
    programScoring: null,
    programInsight: null
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessages, setErrorMessages] = useState({
    programInventory: '',
    costAllocation: '',
    programScoring: '',
    programInsight: ''
  });
  
  const handlePersonnelUpload = (e) => {
    if (e.target.files[0]) {
      setFiles({...files, personnel: e.target.files[0]});
    }
  };

  const handleBudgetUpload = (e) => {
    if (e.target.files[0]) {
      setFiles({...files, departmentBudget: e.target.files[0]});
    }
  };

  const handleWebsiteInput = (e) => {
    setFiles({...files, website: e.target.value});
  };

  const handleOrgNameInput = (e) => {
    setOrgName(e.target.value);
  };

  const isReadyToStart = () => {
    return files.personnel && files.departmentBudget && orgName;
  };

  const submitToApp = async (url, formData) => {
    try {
      console.log("🔄 Step 1: Getting the form page to check for CSRF tokens...");
      
      // First, get the form page to check for any CSRF tokens or hidden fields
      const formPageResponse = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'include' // Include cookies for session
      });
      
      if (formPageResponse.ok) {
        const formPageHtml = await formPageResponse.text();
        console.log("📄 Form page retrieved, checking for CSRF tokens...");
        
        // Look for CSRF tokens or hidden fields
        const csrfMatches = formPageHtml.match(/<input[^>]*name="[^"]*csrf[^"]*"[^>]*value="([^"]*)"/i);
        const hiddenInputs = formPageHtml.match(/<input[^>]*type="hidden"[^>]*>/gi) || [];
        
        if (csrfMatches) {
          console.log("🔑 Found CSRF token, adding to form data");
          formData.append(csrfMatches[0].match(/name="([^"]*)"/)[1], csrfMatches[1]);
        }
        
        // Add any other hidden fields
        hiddenInputs.forEach(input => {
          const nameMatch = input.match(/name="([^"]*)"/);
          const valueMatch = input.match(/value="([^"]*)"/);
          if (nameMatch && valueMatch && nameMatch[1] !== 'file') {
            console.log(`🔑 Adding hidden field: ${nameMatch[1]} = ${valueMatch[1]}`);
            formData.append(nameMatch[1], valueMatch[1]);
          }
        });
      }
      
      console.log("🔄 Step 2: Submitting form with all required fields...");
      console.log("📋 FormData contents before sending:");
      let hasFile = false;
      let hasWebsiteUrl = false;
      let hasProgramsPerDept = false;
      
      for (let [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log(`  ${key}: File(${value.name}, ${value.size} bytes, ${value.type})`);
          console.log(`    - Valid file: ${value.size > 0 ? 'YES' : 'NO'}`);
          console.log(`    - File extension: ${value.name.split('.').pop()}`);
          console.log(`    - Has filename: ${value.name ? 'YES' : 'NO'}`);
          if (key === 'file' && value.name && value.size > 0) {
            hasFile = true;
          }
        } else {
          console.log(`  ${key}: "${value}"`);
          if (key === 'website_url' && value.trim()) {
            hasWebsiteUrl = true;
          }
          if (key === 'programs_per_department' && value) {
            hasProgramsPerDept = true;
          }
        }
      }
      
      console.log("🔍 Validation check:");
      console.log(`  - Has valid file: ${hasFile}`);
      console.log(`  - Has website URL: ${hasWebsiteUrl}`);
      console.log(`  - Has programs per department: ${hasProgramsPerDept}`);
      
      if (!hasFile) {
        console.log("❌ FILE VALIDATION WILL FAIL - No valid file detected");
      }
      if (!hasWebsiteUrl) {
        console.log("❌ URL VALIDATION WILL FAIL - No website URL detected");
      }
      if (!hasProgramsPerDept) {
        console.log("❌ PROGRAMS VALIDATION WILL FAIL - No programs per department detected");
      }
      
      // Add debug headers to see what's happening
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        mode: 'cors',
        credentials: 'include',
        redirect: 'follow'
      });
      
      console.log("📥 Response details:");
      console.log("  - Status:", response.status);
      console.log("  - Status text:", response.statusText);
      console.log("  - Response URL:", response.url);
      console.log("  - Response headers:");
      for (let [key, value] of response.headers.entries()) {
        console.log(`    ${key}: ${value}`);
      }
      
      // Check if this is a redirect vs original response
      if (response.url !== url) {
        console.log("🔄 Request was redirected from:", url);
        console.log("🔄 Request redirected to:", response.url);
      } else {
        console.log("📍 No redirect - response from original URL");
        console.log("⚠️  This usually indicates a server error during form processing");
        console.log("⚠️  Check if required environment variables (like OPENAI_API_KEY) are set");
      }
      
      // Try to find task ID in the response headers or content
      const locationHeader = response.headers.get('location');
      if (locationHeader) {
        console.log("🔗 Location header found:", locationHeader);
      }
      
      // Check if response looks like it has task info
      const responseText = await response.text();
      const taskUrlMatch = responseText.match(/\/task\/([a-zA-Z0-9-]+)/);
      if (taskUrlMatch) {
        console.log("🎯 Found task ID in response:", taskUrlMatch[1]);
        console.log("🔗 Task URL would be:", url.replace(/\/$/, '') + taskUrlMatch[0]);
        
        // Create a new response-like object with the task URL
        const taskUrl = url.replace(/\/$/, '') + taskUrlMatch[0];
        const taskResponse = await fetch(taskUrl, {
          method: 'GET',
          mode: 'cors',
          credentials: 'include'
        });
        
        if (taskResponse.ok) {
          console.log("✅ Successfully accessed task page");
          return taskResponse;
        }
      }
      
      // If no task found, return original response but recreate it since we consumed the text
      const newResponse = new Response(responseText, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        url: response.url
      });
      
      return newResponse;
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      console.log("✅ Form submission successful");
      console.log("📥 Response status:", response.status);
      console.log("📥 Response URL:", response.url);
      
      return response;
    } catch (error) {
      console.error("❌ Form submission failed:", error.message);
      throw new Error(`Form submission failed. Error: ${error.message}`);
    }
  };

  const waitForProcessingComplete = async (taskUrl, maxWaitTime = 120000) => {
    console.log("⏳ Waiting for background processing to complete...");
    console.log("🔗 Task URL:", taskUrl);
    
    // Ensure we're using the direct URL, not proxy URL
    const cleanTaskUrl = taskUrl.replace('https://api.allorigins.win/raw?url=', '');
    console.log("🔗 Clean Task URL:", cleanTaskUrl);
    
    const startTime = Date.now();
    const pollInterval = 5000;
    let attempts = 0;
    
    while (Date.now() - startTime < maxWaitTime) {
      attempts++;
      try {
        console.log(`🔄 Checking processing status (attempt ${attempts})...`);
        const response = await fetch(cleanTaskUrl, {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit'
        });
        const html = await response.text();
        
        console.log(`📊 Status check ${attempts}:`);
        console.log("  - Response URL:", response.url);
        console.log("  - HTML length:", html.length);
        console.log("  - Contains 'Processing':", html.includes('Processing'));
        console.log("  - Contains 'Download Excel File':", html.includes('Download Excel File'));
        console.log("  - Contains 'Error':", html.includes('Error'));
        console.log("  - Contains 'get-file':", html.includes('get-file'));
        
        if (response.url.includes('/download/') || html.includes('Download Excel File') || html.includes('Programs Generated Successfully')) {
          console.log("✅ Processing complete! Redirected to download page");
          return response;
        }
        
        if (html.includes('Processing Your File') || html.includes('Loading...') || html.includes('This may take several minutes')) {
          console.log(`⏳ Still processing (attempt ${attempts}), waiting ${pollInterval/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        }
        
        if (html.includes('Error') || html.includes('error') || html.includes('flash')) {
          console.error("❌ Processing failed with an error");
          console.log("📄 Error page HTML (first 1000 chars):", html.substring(0, 1000));
          throw new Error("Processing failed - check the form data or file format");
        }
        
        if (html.includes('Upload Excel File') && html.includes('Organization Website URL')) {
          console.error("❌ Redirected back to the original form - processing failed");
          console.log("📄 Form page HTML (first 500 chars):", html.substring(0, 500));
          throw new Error("Processing failed - redirected back to the form");
        }
        
        console.log(`🤔 Unexpected response on attempt ${attempts}:`);
        console.log("📄 First 500 chars:", html.substring(0, 500));
        
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
      } catch (error) {
        console.error(`❌ Error while waiting for processing (attempt ${attempts}):`, error);
        if (attempts >= 3) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }
    
    throw new Error(`Processing timeout - took longer than ${maxWaitTime/1000} seconds`);
  };

  const extractDownloadUrl = (html, baseUrl) => {
    console.log("🔍 Searching for download URL in HTML response...");
    
    const patterns = [
      /href="([^"]*\/get-file\/[^"]*)"[^>]*class="btn btn-primary btn-lg"/gi,
      /href="([^"]*\/get-file\/[^"]*)"/gi,
      /href="([^"]*\/download\/[^"]*\.xlsx?)"/gi,
      /href="([^"]*\/file\/[^"]*\.xlsx?)"/gi,
      /href="([^"]*[a-zA-Z0-9_-]+\.xlsx?)"/gi,
    ];
    
    let allMatches = [];
    
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const matches = [...html.matchAll(pattern)];
      if (matches.length > 0) {
        console.log(`✅ Pattern ${i+1} found ${matches.length} matches:`, matches.map(m => m[1]));
        allMatches = allMatches.concat(matches.map(m => m[1]));
      }
    }
    
    if (allMatches.length > 0) {
      const validMatches = allMatches.filter(match => {
        const url = match.toLowerCase();
        return !url.includes('accept=') && 
               !url.includes('.xlsx,.xls') &&
               !url.includes('.xls,.xlsx') &&
               !url.startsWith('.') &&
               url.includes('.xls') &&
               (url.includes('/') || url.includes('http'));
      });
      
      console.log("🔍 Valid download URLs after filtering:", validMatches);
      
      for (const match of validMatches) {
        let downloadPath = match;
        console.log("🔍 Evaluating potential download path:", downloadPath);
        
        downloadPath = downloadPath.replace(/&amp;/g, '&');
        
        if (downloadPath.startsWith('/')) {
          downloadPath = baseUrl + downloadPath;
        } else if (!downloadPath.startsWith('http')) {
          downloadPath = baseUrl + '/' + downloadPath;
        }
        
        console.log("🔗 Final download URL candidate:", downloadPath);
        return downloadPath;
      }
    }
    
    console.log("❌ No download URL found.");
    return null;
  };
  
  const runWorkflow = async () => {
    if (!isReadyToStart()) return;
    
    setIsProcessing(true);
    setAgentStatus({
      programInventory: 'idle',
      costAllocation: 'idle',
      programScoring: 'idle',
      programInsight: 'idle'
    });
    setErrorMessages({
      programInventory: '',
      costAllocation: '',
      programScoring: '',
      programInsight: ''
    });
    
    let inventoryFile = null;
    let costingFile = null;
    let scoringFile = null;
    
    try {
      // Step 1: Program Inventory Agent
      setAgentStatus(prev => ({...prev, programInventory: 'running'}));
      console.log("🚀 Submitting to Program Inventory App...");
      
      try {
        const inventoryFormData = new FormData();
        inventoryFormData.append('file', files.personnel);
        inventoryFormData.append('website_url', files.website || 'https://www.tempe.gov/government/city-clerk-s-office');
        inventoryFormData.append('programs_per_department', '5');
        
        // Debug: Log file details
        console.log("📁 File details:");
        console.log("  - File name:", files.personnel.name);
        console.log("  - File size:", files.personnel.size);
        console.log("  - File type:", files.personnel.type);
        console.log("  - Website URL:", files.website || 'https://www.tempe.gov/government/city-clerk-s-office');
        
        console.log("📋 Form data being sent:");
        for (let [key, value] of inventoryFormData.entries()) {
          console.log(`  ${key}:`, value instanceof File ? value.name : value);
        }
        
        const inventoryResponse = await submitToApp(appUrls.programInventory, inventoryFormData);
        
        console.log("📥 Program Inventory Response received");
        console.log("🔗 Response URL:", inventoryResponse.url);
        
        let finalResponse = inventoryResponse;
        
        if (inventoryResponse.url.includes('/task/') || inventoryResponse.url.includes('processing')) {
          console.log("🔄 Detected background processing, waiting for completion...");
          finalResponse = await waitForProcessingComplete(inventoryResponse.url);
        }
        
        const inventoryHtml = await finalResponse.text();
        console.log("📄 Final response URL:", finalResponse.url);
        console.log("📄 Final HTML length:", inventoryHtml.length);
        
        let inventoryDownloadUrl = null;
        
        // Clean any proxy URLs from final response
        let cleanFinalUrl = finalResponse.url.replace('https://api.allorigins.win/raw?url=', '');
        console.log("🔗 Clean Final URL:", cleanFinalUrl);
        
        if (cleanFinalUrl.includes('/download/')) {
          // Extract filename from download URL
          const downloadMatch = cleanFinalUrl.match(/\/download\/(.+)$/);
          if (downloadMatch) {
            const filename = downloadMatch[1];
            inventoryDownloadUrl = appUrls.programInventory.replace(/\/$/, '') + '/get-file/' + filename;
            console.log("✅ Extracted filename from download URL:", filename);
            console.log("✅ Constructed get-file URL:", inventoryDownloadUrl);
          }
        } else if (cleanFinalUrl.includes('/get-file/') ||
                   cleanFinalUrl.includes('.xlsx') ||
                   cleanFinalUrl.includes('.xls')) {
          inventoryDownloadUrl = cleanFinalUrl;
          console.log("✅ Using clean response URL as download URL:", inventoryDownloadUrl);
        } else {
          console.log("🔍 Response URL is not a direct download, searching HTML...");
          inventoryDownloadUrl = extractDownloadUrl(inventoryHtml, appUrls.programInventory);
          
          if (!inventoryDownloadUrl) {
            console.log("🔍 Trying aggressive URL search in HTML...");
            console.log("📄 Full HTML length:", inventoryHtml.length);
            console.log("📄 HTML contains 'get-file':", inventoryHtml.includes('get-file'));
            console.log("📄 HTML contains 'download':", inventoryHtml.includes('download'));
            console.log("📄 First 1000 chars of HTML:", inventoryHtml.substring(0, 1000));
            console.log("📄 Last 500 chars of HTML:", inventoryHtml.substring(inventoryHtml.length - 500));
            
            // Look for download button with get-file URL
            const getFileMatches = inventoryHtml.match(/href="([^"]*\/get-file\/[^"]*)"/gi);
            console.log("🔍 All get-file href matches:", getFileMatches);
            
            if (getFileMatches && getFileMatches.length > 0) {
              const firstMatch = getFileMatches[0];
              const urlMatch = firstMatch.match(/href="([^"]*)"/);
              if (urlMatch) {
                inventoryDownloadUrl = urlMatch[1];
                if (inventoryDownloadUrl.startsWith('/')) {
                  inventoryDownloadUrl = appUrls.programInventory.replace(/\/$/, '') + inventoryDownloadUrl;
                }
                console.log("✅ Found get-file URL from HTML:", inventoryDownloadUrl);
              }
            }
            
            // If still no URL, try to extract from download page URL
            if (!inventoryDownloadUrl && cleanFinalUrl.includes('download')) {
              const pathParts = cleanFinalUrl.split('/');
              const lastPart = pathParts[pathParts.length - 1];
              if (lastPart && (lastPart.includes('.xlsx') || lastPart.includes('.xls'))) {
                inventoryDownloadUrl = appUrls.programInventory.replace(/\/$/, '') + '/get-file/' + lastPart;
                console.log("✅ Constructed get-file URL from download path:", inventoryDownloadUrl);
              }
            }
          }
        }
        
        if (inventoryDownloadUrl) {
          console.log("✅ Program Inventory Download URL found:", inventoryDownloadUrl);
          
          const fileResponse = await fetch(inventoryDownloadUrl);
          if (!fileResponse.ok) {
            throw new Error(`Failed to download file: ${fileResponse.status}`);
          }
          const blob = await fileResponse.blob();
          inventoryFile = new File([blob], 'program_inventory.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          
          setAgentStatus(prev => ({...prev, programInventory: 'completed'}));
          setOutputFiles(prev => ({
            ...prev, 
            programInventory: {
              name: 'program_inventory.xlsx',
              downloadUrl: inventoryDownloadUrl
            }
          }));
        } else {
          throw new Error("Could not find download URL in Program Inventory response");
        }
      } catch (error) {
        console.error("❌ Program Inventory Error:", error);
        setAgentStatus(prev => ({...prev, programInventory: 'error'}));
        setErrorMessages(prev => ({
          ...prev,
          programInventory: `Error: ${error.message}`
        }));
        throw new Error("Program Inventory step failed");
      }
      
      // Step 2: Cost Allocation Agent
      setAgentStatus(prev => ({...prev, costAllocation: 'running'}));
      console.log("🚀 Submitting to Cost Allocation App...");
      
      try {
        const costFormData = new FormData();
        costFormData.append('program_inventory', inventoryFile);
        costFormData.append('department_budget', files.departmentBudget);
        costFormData.append('organization_name', orgName);
        
        const costResponse = await submitToApp(appUrls.costAllocation, costFormData);
        const costHtml = await costResponse.text();
        
        console.log("📥 Cost Allocation Response received");
        
        let costDownloadUrl = null;
        if (costResponse.url.includes('/download/') || 
            costResponse.url.includes('/get-file/') ||
            costResponse.url.includes('.xlsx') ||
            costResponse.url.includes('.xls')) {
          costDownloadUrl = costResponse.url;
        } else {
          costDownloadUrl = extractDownloadUrl(costHtml, appUrls.costAllocation);
          
          if (!costDownloadUrl) {
            const getFileMatch = costHtml.match(/\/get-file\/[^"'\s<>]+/i);
            if (getFileMatch) {
              costDownloadUrl = appUrls.costAllocation + getFileMatch[0];
            }
          }
        }
        
        if (costDownloadUrl) {
          console.log("✅ Cost Allocation Download URL found:", costDownloadUrl);
          
          const fileResponse = await fetch(costDownloadUrl);
          if (!fileResponse.ok) {
            throw new Error(`Failed to download file: ${fileResponse.status}`);
          }
          const blob = await fileResponse.blob();
          costingFile = new File([blob], 'program_costs.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          
          setAgentStatus(prev => ({...prev, costAllocation: 'completed'}));
          setOutputFiles(prev => ({
            ...prev, 
            costAllocation: {
              name: 'program_costs.xlsx',
              downloadUrl: costDownloadUrl
            }
          }));
        } else {
          throw new Error("Could not find download URL in Cost Allocation response");
        }
      } catch (error) {
        console.error("❌ Cost Allocation Error:", error);
        setAgentStatus(prev => ({...prev, costAllocation: 'error'}));
        setErrorMessages(prev => ({
          ...prev,
          costAllocation: `Error: ${error.message}`
        }));
        throw new Error("Cost Allocation step failed");
      }
      
      // Step 3: Program Scoring Agent
      setAgentStatus(prev => ({...prev, programScoring: 'running'}));
      console.log("🚀 Submitting to Program Scoring App...");
      
      try {
        const scoringFormData = new FormData();
        scoringFormData.append('file', costingFile);
        scoringFormData.append('organization_name', orgName);
        
        const scoringResponse = await submitToApp(appUrls.programScoring, scoringFormData);
        const scoringHtml = await scoringResponse.text();
        
        console.log("📥 Program Scoring Response received");
        
        let scoringDownloadUrl = null;
        if (scoringResponse.url.includes('/download/') || 
            scoringResponse.url.includes('/get-file/') ||
            scoringResponse.url.includes('.xlsx') ||
            scoringResponse.url.includes('.xls')) {
          scoringDownloadUrl = scoringResponse.url;
        } else {
          scoringDownloadUrl = extractDownloadUrl(scoringHtml, appUrls.programScoring);
          
          if (!scoringDownloadUrl) {
            const getFileMatch = scoringHtml.match(/\/get-file\/[^"'\s<>]+/i);
            if (getFileMatch) {
              scoringDownloadUrl = appUrls.programScoring + getFileMatch[0];
            }
          }
        }
        
        if (scoringDownloadUrl) {
          console.log("✅ Program Scoring Download URL found:", scoringDownloadUrl);
          
          const fileResponse = await fetch(scoringDownloadUrl);
          if (!fileResponse.ok) {
            throw new Error(`Failed to download file: ${fileResponse.status}`);
          }
          const blob = await fileResponse.blob();
          scoringFile = new File([blob], 'program_scores.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          
          setAgentStatus(prev => ({...prev, programScoring: 'completed'}));
          setOutputFiles(prev => ({
            ...prev, 
            programScoring: {
              name: 'program_scores.xlsx',
              downloadUrl: scoringDownloadUrl
            }
          }));
        } else {
          throw new Error("Could not find download URL in Program Scoring response");
        }
      } catch (error) {
        console.error("❌ Program Scoring Error:", error);
        setAgentStatus(prev => ({...prev, programScoring: 'error'}));
        setErrorMessages(prev => ({
          ...prev,
          programScoring: `Error: ${error.message}`
        }));
        throw new Error("Program Scoring step failed");
      }
      
      // Step 4: Program Insight Agent
      setAgentStatus(prev => ({...prev, programInsight: 'running'}));
      console.log("🚀 Submitting to Program Insight App...");
      
      try {
        const insightFormData = new FormData();
        insightFormData.append('file', scoringFile);
        insightFormData.append('organization_name', orgName);
        
        const insightResponse = await submitToApp(appUrls.programInsight, insightFormData);
        const insightHtml = await insightResponse.text();
        
        console.log("📥 Program Insight Response received");
        
        let insightDownloadUrl = null;
        if (insightResponse.url.includes('/download/') || 
            insightResponse.url.includes('/get-file/') ||
            insightResponse.url.includes('.xlsx') ||
            insightResponse.url.includes('.xls')) {
          insightDownloadUrl = insightResponse.url;
        } else {
          insightDownloadUrl = extractDownloadUrl(insightHtml, appUrls.programInsight);
          
          if (!insightDownloadUrl) {
            const getFileMatch = insightHtml.match(/\/get-file\/[^"'\s<>]+/i);
            if (getFileMatch) {
              insightDownloadUrl = appUrls.programInsight + getFileMatch[0];
            }
          }
        }
        
        if (insightDownloadUrl) {
          console.log("✅ Program Insight Download URL found:", insightDownloadUrl);
          
          setAgentStatus(prev => ({...prev, programInsight: 'completed'}));
          setOutputFiles(prev => ({
            ...prev, 
            programInsight: {
              name: 'program_insights.xlsx',
              downloadUrl: insightDownloadUrl
            }
          }));
        } else {
          throw new Error("Could not find download URL in Program Insight response");
        }
      } catch (error) {
        console.error("❌ Program Insight Error:", error);
        setAgentStatus(prev => ({...prev, programInsight: 'error'}));
        setErrorMessages(prev => ({
          ...prev,
          programInsight: `Error: ${error.message}`
        }));
        throw new Error("Program Insight step failed");
      }
      
      setCurrentStep(4);
      console.log("🎉 All workflows completed successfully!");
      
    } catch (error) {
      console.error("❌ Workflow error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const StatusIcon = ({ status }) => {
    if (status === 'idle') return null;
    if (status === 'running') return <PlayCircle className="text-blue-500" />;
    if (status === 'completed') return <CheckCircle className="text-green-500" />;
    if (status === 'error') return <AlertCircle className="text-red-500" />;
    return null;
  };
  
  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">PBB Agentic Workflow Orchestrator</h1>
        <p className="text-gray-600">
          Upload your data sources and let our AI agents automate your Priority-Based Budgeting process.
        </p>
      </div>

      <div className="mb-8 p-6 bg-gray-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Input Data</h2>
        
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Organization Name</label>
          <input
            type="text"
            className="w-full p-2 border rounded"
            placeholder="Enter organization name"
            value={orgName}
            onChange={handleOrgNameInput}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 mb-2">Personnel Data (Excel)</label>
            <div className="flex items-center">
              <label className="flex items-center px-4 py-2 bg-blue-500 text-white rounded cursor-pointer hover:bg-blue-600">
                <Upload size={16} className="mr-2" />
                Browse
                <input
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls"
                  onChange={handlePersonnelUpload}
                />
              </label>
              <span className="ml-2 text-sm text-gray-600">
                {files.personnel ? files.personnel.name : 'No file selected'}
              </span>
            </div>
          </div>
          
          <div>
            <label className="block text-gray-700 mb-2">Department Budget (Excel)</label>
            <div className="flex items-center">
              <label className="flex items-center px-4 py-2 bg-blue-500 text-white rounded cursor-pointer hover:bg-blue-600">
                <Upload size={16} className="mr-2" />
                Browse
                <input
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls"
                  onChange={handleBudgetUpload}
                />
              </label>
              <span className="ml-2 text-sm text-gray-600">
                {files.departmentBudget ? files.departmentBudget.name : 'No file selected'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="mt-4">
          <label className="block text-gray-700 mb-2">Organization Website (Optional)</label>
          <input
            type="text"
            className="w-full p-2 border rounded"
            placeholder="https://example.org"
            value={files.website}
            onChange={handleWebsiteInput}
          />
        </div>
      </div>

      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Workflow Status</h2>
          <button
            className={`px-6 py-2 rounded font-medium ${
              isReadyToStart() && !isProcessing
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            onClick={runWorkflow}
            disabled={!isReadyToStart() || isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Run Workflow'}
          </button>
        </div>

        <div className="space-y-6">
          <div className="p-4 border rounded-lg bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 mr-4">1</div>
                <div>
                  <h3 className="font-medium">Program Inventory Agent</h3>
                  <p className="text-sm text-gray-500">Creates program inventory from personnel data</p>
                </div>
              </div>
              <div className="flex items-center">
                <StatusIcon status={agentStatus.programInventory} />
                {outputFiles.programInventory && (
                  <a 
                    href={outputFiles.programInventory.downloadUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center ml-4 px-3 py-1 text-sm bg-green-100 text-green-700 rounded-full hover:bg-green-200 cursor-pointer"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download Output
                  </a>
                )}
              </div>
            </div>
            {errorMessages.programInventory && (
              <div className="mt-2 text-sm text-red-500">{errorMessages.programInventory}</div>
            )}
          </div>

          <div className="p-4 border rounded-lg bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 mr-4">2</div>
                <div>
                  <h3 className="font-medium">Cost Allocation Agent</h3>
                  <p className="text-sm text-gray-500">Allocates costs to programs</p>
                </div>
              </div>
              <div className="flex items-center">
                <StatusIcon status={agentStatus.costAllocation} />
                {outputFiles.costAllocation && (
                  <a 
                    href={outputFiles.costAllocation.downloadUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center ml-4 px-3 py-1 text-sm bg-green-100 text-green-700 rounded-full hover:bg-green-200 cursor-pointer"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download Output
                  </a>
                )}
              </div>
            </div>
            {errorMessages.costAllocation && (
              <div className="mt-2 text-sm text-red-500">{errorMessages.costAllocation}</div>
            )}
          </div>

          <div className="p-4 border rounded-lg bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 mr-4">3</div>
                <div>
                  <h3 className="font-medium">Program Scoring Agent</h3>
                  <p className="text-sm text-gray-500">Evaluates and scores programs</p>
                </div>
              </div>
              <div className="flex items-center">
                <StatusIcon status={agentStatus.programScoring} />
                {outputFiles.programScoring && (
                  <a 
                    href={outputFiles.programScoring.downloadUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center ml-4 px-3 py-1 text-sm bg-green-100 text-green-700 rounded-full hover:bg-green-200 cursor-pointer"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download Output
                  </a>
                )}
              </div>
            </div>
            {errorMessages.programScoring && (
              <div className="mt-2 text-sm text-red-500">{errorMessages.programScoring}</div>
            )}
          </div>
          
          <div className="p-4 border rounded-lg bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 mr-4">4</div>
                <div>
                  <h3 className="font-medium">Program Insight Agent</h3>
                  <p className="text-sm text-gray-500">Generates program insights and opportunities</p>
                </div>
              </div>
              <div className="flex items-center">
                <StatusIcon status={agentStatus.programInsight} />
                {outputFiles.programInsight && (
                  <a 
                    href={outputFiles.programInsight.downloadUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center ml-4 px-3 py-1 text-sm bg-green-100 text-green-700 rounded-full hover:bg-green-200 cursor-pointer"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download Output
                  </a>
                )}
              </div>
            </div>
            {errorMessages.programInsight && (
              <div className="mt-2 text-sm text-red-500">{errorMessages.programInsight}</div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex">
        <Info className="text-blue-500 mr-3 flex-shrink-0 mt-1" />
        <div>
          <h4 className="font-medium text-blue-800">How the Process Works</h4>
          <p className="text-sm text-blue-700">
            This application orchestrates four AI agents that work sequentially:
            1) Program Inventory Agent creates a program inventory from personnel data,
            2) Cost Allocation Agent allocates costs to each program,
            3) Program Scoring Agent evaluates and scores programs, and
            4) Program Insight Agent generates strategic insights and opportunities.
          </p>
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-gray-50 border rounded-lg">
        <h4 className="font-medium mb-3">Access Individual Applications</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <a href={appUrls.programInventory} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
            <div className="h-6 w-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-500 mr-2">1</div>
            Program Inventory Generator
          </a>
          <a href={appUrls.costAllocation} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
            <div className="h-6 w-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-500 mr-2">2</div>
            Budget Allocation App
          </a>
          <a href={appUrls.programScoring} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
            <div className="h-6 w-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-500 mr-2">3</div>
            Program Evaluation Predictor
          </a>
          <a href={appUrls.programInsight} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
            <div className="h-6 w-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-500 mr-2">4</div>
            Program Insights Predictor
          </a>
        </div>
      </div>
    </div>
  );
};

export default PBBWorkflowOrchestrator;