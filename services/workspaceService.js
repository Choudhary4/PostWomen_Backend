const { v4: uuidv4 } = require('uuid');

class WorkspaceService {
  constructor() {
    // In-memory storage
    this.workspaces = new Map();
    this.workspaceMembers = new Map(); // workspaceId -> [memberId, ...]
    this.userWorkspaces = new Map(); // userId -> [workspaceId, ...]
    this.workspaceSettings = new Map(); // workspaceId -> settings
    this.workspaceCollections = new Map(); // workspaceId -> [collectionId, ...]
    this.workspaceEnvironments = new Map(); // workspaceId -> [environmentId, ...]
    this.workspaceActivity = new Map(); // workspaceId -> [activity, ...]
    this.workspaceInvitations = new Map(); // invitationId -> invitation
    this.workspaceTemplates = new Map(); // templateId -> template
    this.workspaceAnalytics = new Map(); // workspaceId -> analytics data
    this.workspaceBackups = new Map(); // backupId -> backup data
    
    this.initializeDefaultWorkspace();
    this.initializeWorkspaceTemplates();
  }

  // Initialize default workspace
  initializeDefaultWorkspace() {
    const defaultWorkspace = {
      id: 'default',
      name: 'Personal Workspace',
      description: 'Your personal workspace for API testing',
      type: 'personal', // 'personal', 'team', 'organization', 'public'
      ownerId: 'admin',
      visibility: 'private', // 'private', 'internal', 'public'
      status: 'active', // 'active', 'archived', 'deleted'
      metadata: {
        tags: ['personal', 'default'],
        category: 'development',
        industry: 'technology'
      },
      createdAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString()
    };

    this.workspaces.set('default', defaultWorkspace);
    this.workspaceMembers.set('default', ['admin']);
    this.userWorkspaces.set('admin', ['default']);
    
    // Default workspace settings
    this.workspaceSettings.set('default', {
      workspaceId: 'default',
      general: {
        allowGuestAccess: false,
        requireInviteApproval: false,
        autoArchiveInactive: false,
        defaultRequestTimeout: 30000,
        maxCollectionsPerUser: 100
      },
      collaboration: {
        enableRealTimeEditing: true,
        enableComments: true,
        enableVersionControl: false,
        requireApprovalForChanges: false
      },
      security: {
        enableSSO: false,
        requireMFA: false,
        allowPasswordAuth: true,
        sessionTimeout: 86400, // 24 hours
        ipWhitelist: []
      },
      notifications: {
        emailNotifications: true,
        slackIntegration: false,
        webhookUrl: null,
        notifyOnChanges: true
      },
      integrations: {
        enableCI: false,
        enableGitIntegration: false,
        enableJiraIntegration: false,
        customWebhooks: []
      },
      appearance: {
        theme: 'light',
        logo: null,
        customColors: {},
        showBranding: true
      }
    });
  }

  // Initialize workspace templates
  initializeWorkspaceTemplates() {
    const templates = [
      {
        id: 'api-development',
        name: 'API Development',
        description: 'Template for API development teams with pre-configured collections and environments',
        category: 'development',
        collections: [
          { name: 'Authentication APIs', description: 'User authentication and authorization' },
          { name: 'User Management', description: 'User CRUD operations' },
          { name: 'Core Business Logic', description: 'Main application APIs' }
        ],
        environments: [
          { name: 'Development', url: 'https://dev-api.example.com' },
          { name: 'Staging', url: 'https://staging-api.example.com' },
          { name: 'Production', url: 'https://api.example.com' }
        ]
      },
      {
        id: 'microservices',
        name: 'Microservices Testing',
        description: 'Template for testing microservices architecture',
        category: 'testing',
        collections: [
          { name: 'Service Discovery', description: 'Service registry and discovery' },
          { name: 'Gateway APIs', description: 'API gateway endpoints' },
          { name: 'Individual Services', description: 'Microservice endpoints' }
        ],
        environments: [
          { name: 'Local Development', url: 'http://localhost:8080' },
          { name: 'Docker Compose', url: 'http://localhost:3000' },
          { name: 'Kubernetes', url: 'https://k8s.example.com' }
        ]
      },
      {
        id: 'ecommerce',
        name: 'E-commerce Platform',
        description: 'Template for e-commerce API testing',
        category: 'business',
        collections: [
          { name: 'Product Catalog', description: 'Product management APIs' },
          { name: 'Shopping Cart', description: 'Cart and checkout APIs' },
          { name: 'Payment Processing', description: 'Payment gateway integration' },
          { name: 'Order Management', description: 'Order processing and fulfillment' }
        ],
        environments: [
          { name: 'Sandbox', url: 'https://sandbox-api.shop.com' },
          { name: 'Production', url: 'https://api.shop.com' }
        ]
      }
    ];

    templates.forEach(template => {
      this.workspaceTemplates.set(template.id, {
        ...template,
        isDefault: true,
        createdAt: new Date().toISOString()
      });
    });
  }

  // Workspace Management
  async createWorkspace(workspaceData, ownerId) {
    const workspaceId = uuidv4();
    const workspace = {
      id: workspaceId,
      name: workspaceData.name,
      description: workspaceData.description || '',
      type: workspaceData.type || 'team',
      ownerId,
      visibility: workspaceData.visibility || 'private',
      status: 'active',
      metadata: {
        tags: workspaceData.tags || [],
        category: workspaceData.category || 'general',
        industry: workspaceData.industry || 'technology'
      },
      createdAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString()
    };

    this.workspaces.set(workspaceId, workspace);
    this.workspaceMembers.set(workspaceId, [ownerId]);
    
    // Add workspace to owner's workspaces
    const userWorkspaces = this.userWorkspaces.get(ownerId) || [];
    userWorkspaces.push(workspaceId);
    this.userWorkspaces.set(ownerId, userWorkspaces);

    // Initialize default settings
    await this.createDefaultSettings(workspaceId);

    // Create from template if specified
    if (workspaceData.templateId) {
      await this.applyTemplate(workspaceId, workspaceData.templateId);
    }

    // Record activity
    this.addActivity(workspaceId, {
      type: 'workspace_created',
      userId: ownerId,
      details: { workspaceName: workspace.name }
    });

    return workspace;
  }

  async getWorkspace(workspaceId) {
    const workspace = this.workspaces.get(workspaceId);
    if (workspace) {
      workspace.lastAccessedAt = new Date().toISOString();
      this.workspaces.set(workspaceId, workspace);
    }
    return workspace;
  }

  async getUserWorkspaces(userId) {
    const workspaceIds = this.userWorkspaces.get(userId) || [];
    const workspaces = [];
    
    for (const workspaceId of workspaceIds) {
      const workspace = this.workspaces.get(workspaceId);
      if (workspace && workspace.status === 'active') {
        const memberCount = (this.workspaceMembers.get(workspaceId) || []).length;
        const lastActivity = await this.getLastActivity(workspaceId);
        
        workspaces.push({
          ...workspace,
          memberCount,
          lastActivity,
          role: await this.getUserRole(userId, workspaceId)
        });
      }
    }
    
    return workspaces.sort((a, b) => new Date(b.lastAccessedAt) - new Date(a.lastAccessedAt));
  }

  async updateWorkspace(workspaceId, updates, userId) {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Check permissions
    if (!await this.hasWorkspacePermission(userId, workspaceId, 'admin')) {
      throw new Error('Insufficient permissions');
    }

    const updatedWorkspace = {
      ...workspace,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.workspaces.set(workspaceId, updatedWorkspace);

    // Record activity
    this.addActivity(workspaceId, {
      type: 'workspace_updated',
      userId,
      details: { updates: Object.keys(updates) }
    });

    return updatedWorkspace;
  }

  async deleteWorkspace(workspaceId, userId) {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    if (workspace.ownerId !== userId) {
      throw new Error('Only workspace owner can delete workspace');
    }

    // Mark as deleted instead of actual deletion
    workspace.status = 'deleted';
    workspace.deletedAt = new Date().toISOString();
    this.workspaces.set(workspaceId, workspace);

    // Record activity
    this.addActivity(workspaceId, {
      type: 'workspace_deleted',
      userId,
      details: { workspaceName: workspace.name }
    });

    return { success: true };
  }

  async archiveWorkspace(workspaceId, userId) {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    if (!await this.hasWorkspacePermission(userId, workspaceId, 'admin')) {
      throw new Error('Insufficient permissions');
    }

    workspace.status = 'archived';
    workspace.archivedAt = new Date().toISOString();
    this.workspaces.set(workspaceId, workspace);

    // Record activity
    this.addActivity(workspaceId, {
      type: 'workspace_archived',
      userId,
      details: { workspaceName: workspace.name }
    });

    return workspace;
  }

  async restoreWorkspace(workspaceId, userId) {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    if (workspace.ownerId !== userId) {
      throw new Error('Only workspace owner can restore workspace');
    }

    workspace.status = 'active';
    delete workspace.archivedAt;
    delete workspace.deletedAt;
    this.workspaces.set(workspaceId, workspace);

    // Record activity
    this.addActivity(workspaceId, {
      type: 'workspace_restored',
      userId,
      details: { workspaceName: workspace.name }
    });

    return workspace;
  }

  // Member Management
  async getWorkspaceMembers(workspaceId) {
    const memberIds = this.workspaceMembers.get(workspaceId) || [];
    const members = [];
    
    // In a real system, you'd fetch user details from user service
    for (const memberId of memberIds) {
      members.push({
        id: memberId,
        role: await this.getUserRole(memberId, workspaceId),
        joinedAt: await this.getMemberJoinDate(memberId, workspaceId),
        lastActiveAt: new Date().toISOString() // Mock data
      });
    }
    
    return members;
  }

  async addWorkspaceMember(workspaceId, userId, addedBy, role = 'member') {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Check permissions
    if (!await this.hasWorkspacePermission(addedBy, workspaceId, 'admin')) {
      throw new Error('Insufficient permissions');
    }

    const members = this.workspaceMembers.get(workspaceId) || [];
    if (members.includes(userId)) {
      throw new Error('User is already a workspace member');
    }

    members.push(userId);
    this.workspaceMembers.set(workspaceId, members);

    // Add workspace to user's workspaces
    const userWorkspaces = this.userWorkspaces.get(userId) || [];
    userWorkspaces.push(workspaceId);
    this.userWorkspaces.set(userId, userWorkspaces);

    // Record activity
    this.addActivity(workspaceId, {
      type: 'member_added',
      userId: addedBy,
      details: { addedUserId: userId, role }
    });

    return { success: true };
  }

  async removeWorkspaceMember(workspaceId, userId, removedBy) {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Check permissions
    if (userId !== removedBy && !await this.hasWorkspacePermission(removedBy, workspaceId, 'admin')) {
      throw new Error('Insufficient permissions');
    }

    // Cannot remove workspace owner
    if (workspace.ownerId === userId && userId !== removedBy) {
      throw new Error('Cannot remove workspace owner');
    }

    const members = this.workspaceMembers.get(workspaceId) || [];
    const filtered = members.filter(id => id !== userId);
    this.workspaceMembers.set(workspaceId, filtered);

    // Remove workspace from user's workspaces
    const userWorkspaces = this.userWorkspaces.get(userId) || [];
    const filteredUserWorkspaces = userWorkspaces.filter(id => id !== workspaceId);
    this.userWorkspaces.set(userId, filteredUserWorkspaces);

    // Record activity
    this.addActivity(workspaceId, {
      type: 'member_removed',
      userId: removedBy,
      details: { removedUserId: userId }
    });

    return { success: true };
  }

  // Settings Management
  async getWorkspaceSettings(workspaceId) {
    return this.workspaceSettings.get(workspaceId);
  }

  async updateWorkspaceSettings(workspaceId, settings, userId) {
    if (!await this.hasWorkspacePermission(userId, workspaceId, 'admin')) {
      throw new Error('Insufficient permissions');
    }

    const current = this.workspaceSettings.get(workspaceId) || {};
    const updated = {
      ...current,
      ...settings,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    };

    this.workspaceSettings.set(workspaceId, updated);

    // Record activity
    this.addActivity(workspaceId, {
      type: 'settings_updated',
      userId,
      details: { updatedSections: Object.keys(settings) }
    });

    return updated;
  }

  async createDefaultSettings(workspaceId) {
    const defaultSettings = {
      workspaceId,
      general: {
        allowGuestAccess: false,
        requireInviteApproval: false,
        autoArchiveInactive: false,
        defaultRequestTimeout: 30000,
        maxCollectionsPerUser: 100
      },
      collaboration: {
        enableRealTimeEditing: true,
        enableComments: true,
        enableVersionControl: false,
        requireApprovalForChanges: false
      },
      security: {
        enableSSO: false,
        requireMFA: false,
        allowPasswordAuth: true,
        sessionTimeout: 86400,
        ipWhitelist: []
      },
      notifications: {
        emailNotifications: true,
        slackIntegration: false,
        webhookUrl: null,
        notifyOnChanges: true
      },
      integrations: {
        enableCI: false,
        enableGitIntegration: false,
        enableJiraIntegration: false,
        customWebhooks: []
      },
      appearance: {
        theme: 'light',
        logo: null,
        customColors: {},
        showBranding: true
      },
      createdAt: new Date().toISOString()
    };

    this.workspaceSettings.set(workspaceId, defaultSettings);
    return defaultSettings;
  }

  // Templates
  async getWorkspaceTemplates() {
    return Array.from(this.workspaceTemplates.values());
  }

  async getTemplate(templateId) {
    return this.workspaceTemplates.get(templateId);
  }

  async createTemplate(templateData, createdBy) {
    const templateId = uuidv4();
    const template = {
      id: templateId,
      name: templateData.name,
      description: templateData.description || '',
      category: templateData.category || 'custom',
      collections: templateData.collections || [],
      environments: templateData.environments || [],
      settings: templateData.settings || {},
      isDefault: false,
      createdBy,
      createdAt: new Date().toISOString()
    };

    this.workspaceTemplates.set(templateId, template);
    return template;
  }

  async applyTemplate(workspaceId, templateId) {
    const template = this.workspaceTemplates.get(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // In a real system, this would create collections and environments
    // For now, just store the template reference
    const workspace = this.workspaces.get(workspaceId);
    if (workspace) {
      workspace.templateId = templateId;
      workspace.templateAppliedAt = new Date().toISOString();
      this.workspaces.set(workspaceId, workspace);
    }

    return { success: true, applied: template.name };
  }

  // Activity and Analytics
  addActivity(workspaceId, activity) {
    const activities = this.workspaceActivity.get(workspaceId) || [];
    activities.push({
      ...activity,
      id: uuidv4(),
      timestamp: new Date().toISOString()
    });

    // Keep only last 500 activities
    if (activities.length > 500) {
      activities.splice(0, activities.length - 500);
    }

    this.workspaceActivity.set(workspaceId, activities);
  }

  async getWorkspaceActivity(workspaceId, limit = 50) {
    const activities = this.workspaceActivity.get(workspaceId) || [];
    return activities
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  async getLastActivity(workspaceId) {
    const activities = this.workspaceActivity.get(workspaceId) || [];
    return activities.length > 0 ? activities[activities.length - 1] : null;
  }

  async getWorkspaceAnalytics(workspaceId, timeRange = '30d') {
    const activities = this.workspaceActivity.get(workspaceId) || [];
    const cutoff = new Date(Date.now() - this.parseTimeRange(timeRange));
    
    const recentActivities = activities.filter(a => new Date(a.timestamp) > cutoff);
    
    // Basic analytics
    const memberCount = (this.workspaceMembers.get(workspaceId) || []).length;
    const collectionCount = (this.workspaceCollections.get(workspaceId) || []).length;
    const environmentCount = (this.workspaceEnvironments.get(workspaceId) || []).length;
    
    // Activity breakdown
    const activityTypes = {};
    recentActivities.forEach(activity => {
      activityTypes[activity.type] = (activityTypes[activity.type] || 0) + 1;
    });

    // Most active users
    const userActivity = {};
    recentActivities.forEach(activity => {
      userActivity[activity.userId] = (userActivity[activity.userId] || 0) + 1;
    });

    const analytics = {
      workspaceId,
      timeRange,
      overview: {
        memberCount,
        collectionCount,
        environmentCount,
        totalActivities: recentActivities.length
      },
      activityBreakdown: activityTypes,
      mostActiveUsers: Object.entries(userActivity)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([userId, count]) => ({ userId, activityCount: count })),
      trends: this.calculateActivityTrends(recentActivities, timeRange),
      generatedAt: new Date().toISOString()
    };

    this.workspaceAnalytics.set(workspaceId, analytics);
    return analytics;
  }

  calculateActivityTrends(activities, timeRange) {
    // Group activities by day
    const dailyActivity = {};
    
    activities.forEach(activity => {
      const day = activity.timestamp.split('T')[0];
      dailyActivity[day] = (dailyActivity[day] || 0) + 1;
    });

    return Object.entries(dailyActivity)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  }

  // Permissions and Roles
  async getUserRole(userId, workspaceId) {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return null;
    }

    if (workspace.ownerId === userId) {
      return 'owner';
    }

    const members = this.workspaceMembers.get(workspaceId) || [];
    if (members.includes(userId)) {
      // In a real system, roles would be stored separately
      const memberIndex = members.indexOf(userId);
      return memberIndex < 2 ? 'admin' : 'member';
    }

    return null;
  }

  async hasWorkspacePermission(userId, workspaceId, requiredPermission) {
    const role = await this.getUserRole(userId, workspaceId);
    if (!role) {
      return false;
    }

    const permissions = {
      owner: ['admin', 'write', 'read'],
      admin: ['admin', 'write', 'read'],
      member: ['write', 'read'],
      viewer: ['read']
    };

    return permissions[role]?.includes(requiredPermission) || false;
  }

  // Workspace Invitations
  async createWorkspaceInvitation(workspaceId, email, invitedBy, role = 'member') {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    if (!await this.hasWorkspacePermission(invitedBy, workspaceId, 'admin')) {
      throw new Error('Insufficient permissions');
    }

    const invitationId = uuidv4();
    const invitation = {
      id: invitationId,
      workspaceId,
      email,
      role,
      invitedBy,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };

    this.workspaceInvitations.set(invitationId, invitation);

    // Record activity
    this.addActivity(workspaceId, {
      type: 'invitation_sent',
      userId: invitedBy,
      details: { email, role }
    });

    return invitation;
  }

  async getWorkspaceInvitations(workspaceId) {
    const invitations = [];
    for (const invitation of this.workspaceInvitations.values()) {
      if (invitation.workspaceId === workspaceId) {
        invitations.push(invitation);
      }
    }
    return invitations;
  }

  // Backup and Restore
  async createBackup(workspaceId, userId, options = {}) {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    if (!await this.hasWorkspacePermission(userId, workspaceId, 'admin')) {
      throw new Error('Insufficient permissions');
    }

    const backupId = uuidv4();
    const backup = {
      id: backupId,
      workspaceId,
      name: options.name || `Backup ${new Date().toLocaleDateString()}`,
      description: options.description || '',
      data: {
        workspace,
        settings: this.workspaceSettings.get(workspaceId),
        members: this.workspaceMembers.get(workspaceId),
        collections: this.workspaceCollections.get(workspaceId) || [],
        environments: this.workspaceEnvironments.get(workspaceId) || [],
        activity: options.includeActivity ? this.workspaceActivity.get(workspaceId) : []
      },
      createdBy: userId,
      createdAt: new Date().toISOString(),
      size: 0 // Would calculate actual size
    };

    this.workspaceBackups.set(backupId, backup);

    // Record activity
    this.addActivity(workspaceId, {
      type: 'backup_created',
      userId,
      details: { backupName: backup.name }
    });

    return backup;
  }

  async getWorkspaceBackups(workspaceId) {
    const backups = [];
    for (const backup of this.workspaceBackups.values()) {
      if (backup.workspaceId === workspaceId) {
        backups.push({
          id: backup.id,
          name: backup.name,
          description: backup.description,
          createdBy: backup.createdBy,
          createdAt: backup.createdAt,
          size: backup.size
        });
      }
    }
    return backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // Utility Methods
  async getMemberJoinDate(userId, workspaceId) {
    // In a real system, this would be stored
    return new Date().toISOString();
  }

  parseTimeRange(timeRange) {
    const units = {
      'd': 24 * 60 * 60 * 1000,
      'w': 7 * 24 * 60 * 60 * 1000,
      'm': 30 * 24 * 60 * 60 * 1000
    };
    
    const match = timeRange.match(/^(\d+)([dwm])$/);
    if (!match) return 30 * 24 * 60 * 60 * 1000; // Default 30 days
    
    const [, amount, unit] = match;
    return parseInt(amount) * units[unit];
  }

  // Data Export/Import
  exportWorkspace(workspaceId) {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      workspace,
      settings: this.workspaceSettings.get(workspaceId),
      members: this.workspaceMembers.get(workspaceId),
      collections: this.workspaceCollections.get(workspaceId) || [],
      environments: this.workspaceEnvironments.get(workspaceId) || [],
      activity: this.workspaceActivity.get(workspaceId) || []
    };
  }

  importWorkspace(data, userId) {
    try {
      const workspaceId = uuidv4();
      const workspace = {
        ...data.workspace,
        id: workspaceId,
        ownerId: userId,
        importedAt: new Date().toISOString()
      };

      this.workspaces.set(workspaceId, workspace);
      
      if (data.settings) {
        this.workspaceSettings.set(workspaceId, { ...data.settings, workspaceId });
      }
      
      this.workspaceMembers.set(workspaceId, [userId]);
      
      // Add to user's workspaces
      const userWorkspaces = this.userWorkspaces.get(userId) || [];
      userWorkspaces.push(workspaceId);
      this.userWorkspaces.set(userId, userWorkspaces);

      return workspace;
    } catch (error) {
      throw new Error(`Import failed: ${error.message}`);
    }
  }

  // Statistics
  getStatistics() {
    const activeWorkspaces = Array.from(this.workspaces.values()).filter(w => w.status === 'active');
    const archivedWorkspaces = Array.from(this.workspaces.values()).filter(w => w.status === 'archived');
    
    return {
      totalWorkspaces: this.workspaces.size,
      activeWorkspaces: activeWorkspaces.length,
      archivedWorkspaces: archivedWorkspaces.length,
      totalMembers: Array.from(this.workspaceMembers.values()).flat().length,
      totalTemplates: this.workspaceTemplates.size,
      totalBackups: this.workspaceBackups.size
    };
  }

  // Cleanup
  cleanup() {
    const now = new Date();
    
    // Remove expired invitations
    for (const [id, invitation] of this.workspaceInvitations) {
      if (new Date(invitation.expiresAt) < now) {
        this.workspaceInvitations.delete(id);
      }
    }
    
    // Archive inactive workspaces (no activity for 6 months)
    const sixMonthsAgo = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
    for (const workspace of this.workspaces.values()) {
      if (workspace.status === 'active' && new Date(workspace.lastAccessedAt) < sixMonthsAgo) {
        const settings = this.workspaceSettings.get(workspace.id);
        if (settings?.general?.autoArchiveInactive) {
          workspace.status = 'archived';
          workspace.archivedAt = new Date().toISOString();
          this.workspaces.set(workspace.id, workspace);
        }
      }
    }
  }
}

module.exports = new WorkspaceService();