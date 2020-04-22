import graphql from 'babel-plugin-relay/macro'
import React from 'react'
import {createFragmentContainer} from 'react-relay'
import useEmailItemGrid from '../../../../../hooks/useEmailItemGrid'
import {PALETTE} from '../../../../../styles/paletteV2'
import {FONT_FAMILY, ICON_SIZE} from '../../../../../styles/typographyV2'
import {RetroTopic_topic} from '../../../../../__generated__/RetroTopic_topic.graphql'
import emailDir from '../../../emailDir'
import AnchorIfEmail from './AnchorIfEmail'
import EmailReflectionCard from './EmailReflectionCard'
import plural from '../../../../../utils/plural'

const topicThemeHeading = {
  color: PALETTE.TEXT_MAIN,
  display: 'block',
  fontFamily: FONT_FAMILY.SANS_SERIF,
  fontSize: 16,
  fontWeight: 600,
  textDecoration: 'none'
}

const votesBlock = {
  fontSize: 14,
  fontWeight: 600,
  lineHeight: ICON_SIZE.MD18,
  padding: '8px 0px'
}

const voteCountStyle = {
  color: PALETTE.TEXT_GRAY,
  paddingLeft: 4,
  textDecoration: 'none'
}

const imageStyle = {
  verticalAlign: 'text-bottom'
}

const commentLinkStyle = {
  color: PALETTE.TEXT_BLUE,
  display: 'block',
  fontFamily: FONT_FAMILY.SANS_SERIF,
  fontSize: 13,
  fontWeight: 600,
  textDecoration: 'none'
}

interface Props {
  isEmail: boolean
  topic: RetroTopic_topic
  to: string
}

const RetroTopic = (props: Props) => {
  const {isEmail, to, topic} = props
  const {reflections, title, voteCount, commentCount} = topic
  const imageSource = isEmail ? 'static' : 'local'
  const icon = imageSource === 'local' ? 'thumb_up_18.svg' : 'thumb_up_18@3x.png'
  const src = `${emailDir}${icon}`
  const grid = useEmailItemGrid(reflections, 3)
  const commentLinkLabel =
    commentCount === 0
      ? 'No Comments'
      : commentCount >= 101
      ? 'See 100+ Comments'
      : `See ${commentCount} ${plural(commentCount, 'Comment')}`
  return (
    <>
      <tr>
        <td align='center' style={{paddingTop: 20}}>
          <AnchorIfEmail href={to} isEmail={isEmail} style={topicThemeHeading}>
            {'“'}
            {title}
            {'”'}
          </AnchorIfEmail>
        </td>
      </tr>
      <tr>
        <td align='center' style={votesBlock}>
          <AnchorIfEmail href={to} isEmail={isEmail}>
            <img crossOrigin='' height='18' src={src} width='18' style={imageStyle} />
          </AnchorIfEmail>
          <AnchorIfEmail href={to} isEmail={isEmail} style={voteCountStyle}>
            {voteCount}
          </AnchorIfEmail>
        </td>
      </tr>
      <tr>
        <td align='center'>
          <AnchorIfEmail href={to} isEmail={isEmail} style={commentLinkStyle}>
            {commentLinkLabel}
          </AnchorIfEmail>
        </td>
      </tr>
      <tr>
        <td>
          {grid((reflectionCard) => (
            <EmailReflectionCard reflection={reflectionCard} />
          ))}
        </td>
      </tr>
    </>
  )
}

export default createFragmentContainer(RetroTopic, {
  topic: graphql`
    fragment RetroTopic_topic on RetroReflectionGroup {
      commentCount
      title
      voteCount
      reflections {
        ...EmailReflectionCard_reflection
      }
    }
  `
})
