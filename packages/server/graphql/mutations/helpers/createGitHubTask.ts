import {stateToMarkdown} from 'draft-js-export-markdown'
import {GraphQLResolveInfo} from 'graphql'
import splitDraftContent from '../../../../client/utils/draftjs/splitDraftContent'
import {GetGitHubAuthByUserIdTeamIdResult} from '../../../postgres/queries/getGitHubAuthByUserIdTeamId'
import {
  CreateIssueMutation,
  CreateIssueMutationVariables,
  GetRepoInfoQuery,
  GetRepoInfoQueryVariables
} from '../../../types/githubTypes'
import createIssueMutation from '../../../utils/githubQueries/createIssue.graphql'
import getRepoInfo from '../../../utils/githubQueries/getRepoInfo.graphql'
import {GQLContext} from '../../graphql'
import {GitHubRequest} from '../../rootSchema'

const createGitHubTask = async (
  rawContent: string,
  repoOwner: string,
  repoName: string,
  githubAuth: GetGitHubAuthByUserIdTeamIdResult,
  context: GQLContext,
  info: GraphQLResolveInfo
) => {
  const {accessToken, login} = githubAuth
  const {title, contentState} = splitDraftContent(rawContent)
  const body = stateToMarkdown(contentState)
  const githubRequest = (info.schema as any).githubRequest as GitHubRequest
  const endpointContext = {accessToken}
  const {data: repoInfo, errors} = await githubRequest<GetRepoInfoQuery, GetRepoInfoQueryVariables>(
    {
      query: getRepoInfo,
      variables: {
        assigneeLogin: login,
        repoName,
        repoOwner
      },
      info,
      endpointContext,
      batchRef: context
    }
  )

  if (errors) {
    return {error: new Error(errors[0].message)}
  }

  const {repository, user} = repoInfo
  if (!repository || !user) {
    return {
      error: new Error('GitHub repo/user not found')
    }
  }

  const {id: repositoryId} = repository
  const {id: ghAssigneeId} = user
  const {data: createIssueData, errors: createIssueErrors} = await githubRequest<
    CreateIssueMutation,
    CreateIssueMutationVariables
  >({
    query: createIssueMutation,
    variables: {
      input: {
        title,
        body,
        repositoryId,
        assigneeIds: [ghAssigneeId]
      }
    },
    info,
    endpointContext,
    batchRef: context
  })
  if (createIssueErrors instanceof Error) {
    return {error: new Error(createIssueErrors[0].message)}
  }

  const {createIssue} = createIssueData
  if (!createIssue) {
    return {error: new Error('GitHub create issue failed')}
  }
  const {issue} = createIssue
  if (!issue) {
    return {error: new Error('GitHub create issue failed')}
  }

  const {number: issueNumber} = issue
  return {issueNumber}
}

export default createGitHubTask
