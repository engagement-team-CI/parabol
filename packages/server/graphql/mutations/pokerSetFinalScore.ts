import {GraphQLID, GraphQLNonNull, GraphQLString} from 'graphql'
import {SprintPokerDefaults, SubscriptionChannel} from 'parabol-client/types/constEnums'
import makeAppURL from 'parabol-client/utils/makeAppURL'
import isPhaseComplete from 'parabol-client/utils/meetings/isPhaseComplete'
import JiraIssueId from '../../../client/shared/gqlIds/JiraIssueId'
import appOrigin from '../../appOrigin'
import MeetingPoker from '../../database/types/MeetingPoker'
import {TaskServiceEnum} from '../../database/types/Task'
import updateStage from '../../database/updateStage'
import getTemplateRefById from '../../postgres/queries/getTemplateRefById'
import insertTaskEstimate from '../../postgres/queries/insertTaskEstimate'
import AtlassianServerManager from '../../utils/AtlassianServerManager'
import {getUserId, isTeamMember} from '../../utils/authorization'
import getPhase from '../../utils/getPhase'
import makeScoreJiraComment from '../../utils/makeScoreJiraComment'
import publish from '../../utils/publish'
import {GQLContext} from '../graphql'
import PokerSetFinalScorePayload from '../types/PokerSetFinalScorePayload'

const pokerSetFinalScore = {
  type: GraphQLNonNull(PokerSetFinalScorePayload),
  description: 'Update the final score field & push to the associated integration',
  args: {
    meetingId: {
      type: GraphQLNonNull(GraphQLID)
    },
    stageId: {
      type: GraphQLNonNull(GraphQLID)
    },
    finalScore: {
      description: 'The label from the scale value',
      type: GraphQLNonNull(GraphQLString)
    }
  },
  resolve: async (
    _source,
    {meetingId, stageId, finalScore},
    {authToken, dataLoader, socketId: mutatorId}: GQLContext
  ) => {
    const viewerId = getUserId(authToken)
    const operationId = dataLoader.share()
    const subOptions = {mutatorId, operationId}

    //AUTH
    const meeting = (await dataLoader.get('newMeetings').load(meetingId)) as MeetingPoker
    if (!meeting) {
      return {error: {message: 'Meeting not found'}}
    }
    const {
      endedAt,
      phases,
      meetingType,
      teamId,
      createdBy,
      facilitatorUserId,
      templateRefId,
      name: meetingName
    } = meeting
    if (!isTeamMember(authToken, teamId)) {
      return {error: {message: 'Not on the team'}}
    }
    if (endedAt) {
      return {error: {message: 'Meeting has ended'}}
    }
    if (meetingType !== 'poker') {
      return {error: {message: 'Not a poker meeting'}}
    }
    if (isPhaseComplete('ESTIMATE', phases)) {
      return {error: {message: 'Estimate phase is already complete'}}
    }
    if (viewerId !== facilitatorUserId) {
      if (viewerId !== createdBy) {
        return {
          error: {message: 'Not meeting facilitator'}
        }
      }
      return {
        error: {message: 'Not meeting facilitator anymore'}
      }
    }

    // VALIDATION
    const estimatePhase = getPhase(phases, 'ESTIMATE')
    const {stages} = estimatePhase
    const stage = stages.find((stage) => stage.id === stageId)
    if (!stage) {
      return {error: {message: 'Invalid stageId provided'}}
    }
    if (finalScore.length > 4) {
      return {error: {message: 'Score is too long'}}
    }

    // RESOLUTION
    // update integration
    const {creatorUserId, dimensionRefIdx, service, serviceTaskId, discussionId, taskId} = stage
    const templateRef = await getTemplateRefById(templateRefId)
    const {dimensions} = templateRef
    const dimensionRef = dimensions[dimensionRefIdx]
    const {name: dimensionName} = dimensionRef
    let jiraFieldId: string | undefined = undefined
    const getIsJira = async (service: TaskServiceEnum, taskId?: string) => {
      if (service === 'jira') return true
      if (!taskId) return false
      const task = await dataLoader.get('tasks').load(taskId)
      if (!task) return false
      const {integration} = task
      if (!integration) return false
      return integration.service === 'jira'
    }
    const isJira = await getIsJira(service, taskId)
    if (isJira) {
      const auth = await dataLoader.get('freshAtlassianAuth').load({teamId, userId: creatorUserId})
      if (!auth) {
        return {error: {message: 'User no longer has access to Atlassian'}}
      }
      const {accessToken} = auth
      const {cloudId, issueKey, projectKey} = JiraIssueId.split(serviceTaskId)
      const manager = new AtlassianServerManager(accessToken)
      const team = await dataLoader.get('teams').load(teamId)
      const jiraDimensionFields = team.jiraDimensionFields || []
      const dimensionField = jiraDimensionFields.find(
        (dimensionField) =>
          dimensionField.dimensionName === dimensionName &&
          dimensionField.cloudId === cloudId &&
          dimensionField.projectKey === projectKey
      )
      const fieldName = dimensionField?.fieldName ?? SprintPokerDefaults.JIRA_FIELD_COMMENT
      if (fieldName === SprintPokerDefaults.JIRA_FIELD_COMMENT) {
        const stageIdx = stages.findIndex((stage) => stage.id === stageId)
        const discussionURL = makeAppURL(appOrigin, `meet/${meetingId}/estimate/${stageIdx + 1}`)
        const res = await manager.addComment(
          cloudId,
          issueKey,
          makeScoreJiraComment(dimensionName, finalScore || '<None>', meetingName, discussionURL)
        )
        if ('message' in res) {
          return {error: {message: res.message}}
        }
      } else if (fieldName !== SprintPokerDefaults.JIRA_FIELD_NULL) {
        const {fieldId} = dimensionField!
        jiraFieldId = fieldId
        try {
          await manager.updateStoryPoints(cloudId, issueKey, finalScore, fieldId)
        } catch (e) {
          return {error: {message: e.message}}
        }
      }
    }
    await insertTaskEstimate({
      changeSource: 'meeting',
      discussionId,
      jiraFieldId,
      label: finalScore,
      name: dimensionName,
      meetingId,
      stageId,
      taskId,
      userId: viewerId
    })
    // Integration push success! update DB
    // update cache
    stage.finalScore = finalScore
    // update stage in DB
    const updater = (estimateStage) => estimateStage.merge({finalScore})
    await updateStage(meetingId, stageId, 'ESTIMATE', updater)
    const data = {meetingId, stageId}
    publish(SubscriptionChannel.MEETING, meetingId, 'PokerSetFinalScoreSuccess', data, subOptions)
    return data
  }
}

export default pokerSetFinalScore
