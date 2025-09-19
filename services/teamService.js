const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class TeamService {
  constructor() {
    // In-memory storage (in production, use database)
    this.users = new Map();
    this.teams = new Map();
    this.teamMembers = new Map(); // teamId -> [memberId, ...]
    this.userTeams = new Map(); // userId -> [teamId, ...]
    this.invitations = new Map();
    this.sessions = new Map(); // sessionId -> userId
    this.activeCollaborations = new Map(); // resourceId -> [userId, ...]
    this.collaborationEvents = []; // Real-time events log
    
    // Initialize with default admin user
    this.initializeDefaultUser();
  }

  // Initialize default admin user for testing
  initializeDefaultUser() {
    const adminUser = {
      id: 'admin',
      email: 'admin@postman-mvp.com',
      name: 'Administrator',
      role: 'admin',
      avatar: null,
      preferences: {},
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString()
    };
    
    this.users.set('admin', adminUser);
    
    // Create default workspace team
    const defaultTeam = {
      id: 'default',
      name: 'Default Workspace',
      description: 'Default team workspace for individual users',
      type: 'personal',
      ownerId: 'admin',
      settings: {
        visibility: 'private',
        allowInvites: true,
        requireApproval: false
      },
      createdAt: new Date().toISOString()
    };
    
    this.teams.set('default', defaultTeam);
    this.teamMembers.set('default', ['admin']);
    this.userTeams.set('admin', ['default']);
  }

  // User Management
  async createUser(userData) {
    const userId = uuidv4();
    const user = {
      id: userId,
      email: userData.email,
      name: userData.name,
      role: userData.role || 'member',
      avatar: userData.avatar || null,
      preferences: {
        theme: 'light',
        notifications: true,
        emailUpdates: true,
        timezone: 'UTC'
      },
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString()
    };

    // Validate email uniqueness
    for (const existingUser of this.users.values()) {
      if (existingUser.email === userData.email) {
        throw new Error('Email already exists');
      }
    }

    this.users.set(userId, user);
    this.userTeams.set(userId, []);
    
    return user;
  }

  async getUserById(userId) {
    return this.users.get(userId);
  }

  async getUserByEmail(email) {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  async updateUser(userId, updates) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async updateUserLastActive(userId) {
    const user = this.users.get(userId);
    if (user) {
      user.lastActiveAt = new Date().toISOString();
      this.users.set(userId, user);
    }
  }

  // Authentication (simplified)
  async createSession(userId) {
    const sessionId = uuidv4();
    this.sessions.set(sessionId, {
      userId,
      createdAt: new Date().toISOString(),
      lastAccessAt: new Date().toISOString()
    });
    
    await this.updateUserLastActive(userId);
    return sessionId;
  }

  async validateSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    // Update last access
    session.lastAccessAt = new Date().toISOString();
    this.sessions.set(sessionId, session);
    
    await this.updateUserLastActive(session.userId);
    return session.userId;
  }

  async deleteSession(sessionId) {
    return this.sessions.delete(sessionId);
  }

  // Team Management
  async createTeam(teamData, ownerId) {
    const teamId = uuidv4();
    const team = {
      id: teamId,
      name: teamData.name,
      description: teamData.description || '',
      type: teamData.type || 'team', // 'personal', 'team', 'organization'
      ownerId,
      settings: {
        visibility: teamData.visibility || 'private', // 'private', 'internal', 'public'
        allowInvites: teamData.allowInvites !== false,
        requireApproval: teamData.requireApproval || false,
        maxMembers: teamData.maxMembers || 50
      },
      createdAt: new Date().toISOString()
    };

    this.teams.set(teamId, team);
    this.teamMembers.set(teamId, [ownerId]);
    
    // Add team to owner's teams
    const userTeams = this.userTeams.get(ownerId) || [];
    userTeams.push(teamId);
    this.userTeams.set(ownerId, userTeams);

    return team;
  }

  async getTeam(teamId) {
    return this.teams.get(teamId);
  }

  async getUserTeams(userId) {
    const teamIds = this.userTeams.get(userId) || [];
    return teamIds.map(teamId => this.teams.get(teamId)).filter(Boolean);
  }

  async updateTeam(teamId, updates, userId) {
    const team = this.teams.get(teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    // Check permissions
    if (team.ownerId !== userId && !await this.hasTeamPermission(userId, teamId, 'admin')) {
      throw new Error('Insufficient permissions');
    }

    const updatedTeam = {
      ...team,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.teams.set(teamId, updatedTeam);
    return updatedTeam;
  }

  async deleteTeam(teamId, userId) {
    const team = this.teams.get(teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    if (team.ownerId !== userId) {
      throw new Error('Only team owner can delete team');
    }

    // Remove team from all members
    const members = this.teamMembers.get(teamId) || [];
    members.forEach(memberId => {
      const userTeams = this.userTeams.get(memberId) || [];
      const filtered = userTeams.filter(id => id !== teamId);
      this.userTeams.set(memberId, filtered);
    });

    this.teams.delete(teamId);
    this.teamMembers.delete(teamId);
    
    return { success: true };
  }

  // Team Member Management
  async getTeamMembers(teamId) {
    const memberIds = this.teamMembers.get(teamId) || [];
    const members = [];
    
    for (const memberId of memberIds) {
      const user = this.users.get(memberId);
      if (user) {
        const memberInfo = {
          ...user,
          role: await this.getUserTeamRole(memberId, teamId),
          joinedAt: await this.getMemberJoinDate(memberId, teamId)
        };
        members.push(memberInfo);
      }
    }
    
    return members;
  }

  async addTeamMember(teamId, userId, addedBy, role = 'member') {
    const team = this.teams.get(teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    // Check permissions
    if (!await this.hasTeamPermission(addedBy, teamId, 'admin')) {
      throw new Error('Insufficient permissions');
    }

    const members = this.teamMembers.get(teamId) || [];
    if (members.includes(userId)) {
      throw new Error('User is already a team member');
    }

    // Check team capacity
    if (members.length >= team.settings.maxMembers) {
      throw new Error('Team has reached maximum member capacity');
    }

    members.push(userId);
    this.teamMembers.set(teamId, members);

    // Add team to user's teams
    const userTeams = this.userTeams.get(userId) || [];
    userTeams.push(teamId);
    this.userTeams.set(userId, userTeams);

    // Record collaboration event
    this.addCollaborationEvent({
      type: 'member_added',
      teamId,
      userId,
      addedBy,
      role,
      timestamp: new Date().toISOString()
    });

    return { success: true };
  }

  async removeTeamMember(teamId, userId, removedBy) {
    const team = this.teams.get(teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    // Check permissions (owner or admin can remove, or user can remove themselves)
    if (userId !== removedBy && !await this.hasTeamPermission(removedBy, teamId, 'admin')) {
      throw new Error('Insufficient permissions');
    }

    // Cannot remove team owner
    if (team.ownerId === userId && userId !== removedBy) {
      throw new Error('Cannot remove team owner');
    }

    const members = this.teamMembers.get(teamId) || [];
    const filtered = members.filter(id => id !== userId);
    this.teamMembers.set(teamId, filtered);

    // Remove team from user's teams
    const userTeams = this.userTeams.get(userId) || [];
    const filteredUserTeams = userTeams.filter(id => id !== teamId);
    this.userTeams.set(userId, filteredUserTeams);

    // Record collaboration event
    this.addCollaborationEvent({
      type: 'member_removed',
      teamId,
      userId,
      removedBy,
      timestamp: new Date().toISOString()
    });

    return { success: true };
  }

  // Invitation System
  async createInvitation(teamId, email, invitedBy, role = 'member') {
    const team = this.teams.get(teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    // Check permissions
    if (!await this.hasTeamPermission(invitedBy, teamId, 'admin')) {
      throw new Error('Insufficient permissions');
    }

    const invitationId = uuidv4();
    const invitation = {
      id: invitationId,
      teamId,
      email,
      role,
      invitedBy,
      status: 'pending', // 'pending', 'accepted', 'declined', 'expired'
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    };

    this.invitations.set(invitationId, invitation);
    return invitation;
  }

  async getInvitation(invitationId) {
    return this.invitations.get(invitationId);
  }

  async getTeamInvitations(teamId) {
    const invitations = [];
    for (const invitation of this.invitations.values()) {
      if (invitation.teamId === teamId) {
        invitations.push(invitation);
      }
    }
    return invitations;
  }

  async getUserInvitations(email) {
    const invitations = [];
    for (const invitation of this.invitations.values()) {
      if (invitation.email === email && invitation.status === 'pending') {
        const team = this.teams.get(invitation.teamId);
        if (team) {
          invitations.push({
            ...invitation,
            team: {
              id: team.id,
              name: team.name,
              description: team.description
            }
          });
        }
      }
    }
    return invitations;
  }

  async respondToInvitation(invitationId, response, userId) {
    const invitation = this.invitations.get(invitationId);
    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new Error('Invitation already responded to');
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      throw new Error('Invitation has expired');
    }

    invitation.status = response; // 'accepted' or 'declined'
    invitation.respondedAt = new Date().toISOString();
    this.invitations.set(invitationId, invitation);

    if (response === 'accepted') {
      await this.addTeamMember(invitation.teamId, userId, invitation.invitedBy, invitation.role);
    }

    return invitation;
  }

  // Permissions and Roles
  async getUserTeamRole(userId, teamId) {
    const team = this.teams.get(teamId);
    if (!team) {
      return null;
    }

    if (team.ownerId === userId) {
      return 'owner';
    }

    const members = this.teamMembers.get(teamId) || [];
    if (members.includes(userId)) {
      // In a real system, roles would be stored separately
      // For now, return 'admin' for the first few members, 'member' for others
      const memberIndex = members.indexOf(userId);
      return memberIndex < 2 ? 'admin' : 'member';
    }

    return null;
  }

  async hasTeamPermission(userId, teamId, requiredPermission) {
    const role = await this.getUserTeamRole(userId, teamId);
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

  // Real-time Collaboration
  async startCollaboration(resourceId, userId, resourceType = 'collection') {
    let collaborators = this.activeCollaborations.get(resourceId) || [];
    
    if (!collaborators.find(c => c.userId === userId)) {
      collaborators.push({
        userId,
        resourceType,
        startedAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString()
      });
      
      this.activeCollaborations.set(resourceId, collaborators);
      
      // Record collaboration event
      this.addCollaborationEvent({
        type: 'collaboration_started',
        resourceId,
        resourceType,
        userId,
        timestamp: new Date().toISOString()
      });
    }

    return collaborators;
  }

  async endCollaboration(resourceId, userId) {
    let collaborators = this.activeCollaborations.get(resourceId) || [];
    collaborators = collaborators.filter(c => c.userId !== userId);
    
    if (collaborators.length === 0) {
      this.activeCollaborations.delete(resourceId);
    } else {
      this.activeCollaborations.set(resourceId, collaborators);
    }

    // Record collaboration event
    this.addCollaborationEvent({
      type: 'collaboration_ended',
      resourceId,
      userId,
      timestamp: new Date().toISOString()
    });

    return collaborators;
  }

  async getActiveCollaborators(resourceId) {
    const collaborators = this.activeCollaborations.get(resourceId) || [];
    const enriched = [];
    
    for (const collab of collaborators) {
      const user = this.users.get(collab.userId);
      if (user) {
        enriched.push({
          ...collab,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            avatar: user.avatar
          }
        });
      }
    }
    
    return enriched;
  }

  async updateCollaborationActivity(resourceId, userId) {
    const collaborators = this.activeCollaborations.get(resourceId) || [];
    const collaborator = collaborators.find(c => c.userId === userId);
    
    if (collaborator) {
      collaborator.lastActiveAt = new Date().toISOString();
      this.activeCollaborations.set(resourceId, collaborators);
    }
    
    return collaborators;
  }

  // Collaboration Events and Activity
  addCollaborationEvent(event) {
    this.collaborationEvents.push({
      ...event,
      id: uuidv4()
    });
    
    // Keep only last 1000 events
    if (this.collaborationEvents.length > 1000) {
      this.collaborationEvents = this.collaborationEvents.slice(-1000);
    }
  }

  async getCollaborationActivity(teamId, limit = 50) {
    // Filter events for team resources
    const teamEvents = this.collaborationEvents.filter(event => {
      // In a real system, you'd check if the resource belongs to the team
      return true; // For now, return all events
    });
    
    return teamEvents
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  // Utility Methods
  async getMemberJoinDate(userId, teamId) {
    // In a real system, this would be stored
    return new Date().toISOString();
  }

  // Statistics and Analytics
  async getTeamStatistics(teamId) {
    const team = this.teams.get(teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    const members = this.teamMembers.get(teamId) || [];
    const invitations = await this.getTeamInvitations(teamId);
    
    const activeCollaborations = Array.from(this.activeCollaborations.values())
      .flat()
      .filter(c => members.includes(c.userId));

    return {
      memberCount: members.length,
      pendingInvitations: invitations.filter(i => i.status === 'pending').length,
      activeCollaborations: activeCollaborations.length,
      teamAge: Math.floor((new Date() - new Date(team.createdAt)) / (1000 * 60 * 60 * 24)),
      recentActivity: await this.getCollaborationActivity(teamId, 10)
    };
  }

  async getAllUsers() {
    return Array.from(this.users.values());
  }

  async getAllTeams() {
    return Array.from(this.teams.values());
  }

  // Data Export/Import
  exportData() {
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      users: Array.from(this.users.values()),
      teams: Array.from(this.teams.values()),
      teamMembers: Object.fromEntries(this.teamMembers),
      userTeams: Object.fromEntries(this.userTeams),
      invitations: Array.from(this.invitations.values())
    };
  }

  importData(data) {
    try {
      let imported = 0;

      if (data.users) {
        data.users.forEach(user => {
          this.users.set(user.id, user);
          imported++;
        });
      }

      if (data.teams) {
        data.teams.forEach(team => {
          this.teams.set(team.id, team);
          imported++;
        });
      }

      if (data.teamMembers) {
        Object.entries(data.teamMembers).forEach(([teamId, members]) => {
          this.teamMembers.set(teamId, members);
        });
      }

      if (data.userTeams) {
        Object.entries(data.userTeams).forEach(([userId, teams]) => {
          this.userTeams.set(userId, teams);
        });
      }

      if (data.invitations) {
        data.invitations.forEach(invitation => {
          this.invitations.set(invitation.id, invitation);
          imported++;
        });
      }

      return { success: true, imported };
    } catch (error) {
      throw new Error(`Import failed: ${error.message}`);
    }
  }

  // Cleanup expired sessions and invitations
  cleanup() {
    const now = new Date();
    
    // Remove expired invitations
    for (const [id, invitation] of this.invitations) {
      if (new Date(invitation.expiresAt) < now) {
        this.invitations.delete(id);
      }
    }
    
    // Remove old sessions (older than 30 days)
    for (const [id, session] of this.sessions) {
      const sessionAge = now - new Date(session.lastAccessAt);
      if (sessionAge > 30 * 24 * 60 * 60 * 1000) {
        this.sessions.delete(id);
      }
    }
  }
}

module.exports = new TeamService();