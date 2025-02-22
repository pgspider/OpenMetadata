/*
 *  Copyright 2022 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import Icon from '@ant-design/icons';
import { Card, Space, Tooltip, Typography } from 'antd';
import { ReactComponent as CommentIcon } from 'assets/svg/comment.svg';
import { ReactComponent as EditIcon } from 'assets/svg/edit-new.svg';
import { ReactComponent as RequestIcon } from 'assets/svg/request-icon.svg';
import { DE_ACTIVE_COLOR } from 'constants/constants';
import { EntityType } from 'enums/entity.enum';
import { t } from 'i18next';
import { isUndefined } from 'lodash';
import React from 'react';
import { useHistory } from 'react-router';
import {
  getRequestDescriptionPath,
  getUpdateDescriptionPath,
  TASK_ENTITIES,
} from 'utils/TasksUtils';
import { EntityField } from '../../../constants/Feeds.constants';
import { Table } from '../../../generated/entity/data/table';
import { EntityFieldThreads } from '../../../interface/feed.interface';
import { getEntityFeedLink } from '../../../utils/EntityUtils';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import RichTextEditorPreviewer from '../rich-text-editor/RichTextEditorPreviewer';
const { Text } = Typography;

interface Props {
  entityName?: string;
  owner?: Table['owner'];
  hasEditAccess?: boolean;
  removeBlur?: boolean;
  description?: string;
  isEdit?: boolean;
  isReadOnly?: boolean;
  entityType: EntityType;
  entityFqn?: string;
  entityFieldThreads?: EntityFieldThreads[];
  onThreadLinkSelect?: (value: string) => void;
  onDescriptionEdit?: () => void;
  onCancel?: () => void;
  onDescriptionUpdate?: (value: string) => Promise<void>;
  onSuggest?: (value: string) => void;
  onEntityFieldSelect?: (value: string) => void;
  wrapInCard?: boolean;
  isVersionView?: boolean;
}
const DescriptionV1 = ({
  hasEditAccess,
  onDescriptionEdit,
  description = '',
  isEdit,
  onCancel,
  onDescriptionUpdate,
  isReadOnly = false,
  removeBlur = false,
  entityName,
  entityFieldThreads,
  onThreadLinkSelect,
  entityType,
  entityFqn,
  wrapInCard = false,
  isVersionView,
}: Props) => {
  const descriptionThread = entityFieldThreads?.[0];
  const history = useHistory();

  const handleRequestDescription = () => {
    history.push(
      getRequestDescriptionPath(entityType as string, entityFqn as string)
    );
  };

  const handleUpdateDescription = () => {
    history.push(
      getUpdateDescriptionPath(entityType as string, entityFqn as string)
    );
  };

  const editButton = () => {
    const isDescriptionThread = !isUndefined(descriptionThread);
    const extraIcons = (
      <Icon
        component={CommentIcon}
        data-testid={
          isDescriptionThread
            ? 'description-thread'
            : 'start-description-thread'
        }
        style={{ color: DE_ACTIVE_COLOR }}
        width={20}
        onClick={() => {
          isDescriptionThread
            ? onThreadLinkSelect?.(descriptionThread?.entityLink ?? '')
            : onThreadLinkSelect?.(
                getEntityFeedLink(
                  entityType,
                  entityFqn,
                  EntityField.DESCRIPTION
                )
              );
        }}
      />
    );

    const taskAction = () => {
      const hasDescription = Boolean(description.trim());

      const isTaskEntity = TASK_ENTITIES.includes(entityType as EntityType);

      if (!isTaskEntity) {
        return null;
      }

      return (
        <Tooltip
          title={
            hasDescription
              ? t('message.request-update-description')
              : t('message.request-description')
          }>
          <Icon
            component={RequestIcon}
            data-testid="request-description"
            style={{ color: DE_ACTIVE_COLOR }}
            onClick={
              hasDescription
                ? handleUpdateDescription
                : handleRequestDescription
            }
          />
        </Tooltip>
      );
    };

    return !isReadOnly && hasEditAccess ? (
      <Space className="w-full" size={12}>
        <Icon
          component={EditIcon}
          data-testid="edit-description"
          style={{ color: DE_ACTIVE_COLOR }}
          onClick={onDescriptionEdit}
        />
        {taskAction()}
        {extraIcons}
      </Space>
    ) : (
      <Space>
        {taskAction()} {extraIcons}
      </Space>
    );
  };

  const content = (
    <>
      <Space
        className="schema-description d-flex"
        direction="vertical"
        size={16}>
        <Space size="middle">
          <Text className="right-panel-label">{t('label.description')}</Text>
          {!isVersionView && editButton()}
        </Space>
        <div>
          {description?.trim() ? (
            <RichTextEditorPreviewer
              enableSeeMoreVariant={!removeBlur}
              markdown={description}
            />
          ) : (
            <span>{t('label.no-description')}</span>
          )}
          <ModalWithMarkdownEditor
            header={t('label.edit-description-for', { entityName })}
            placeholder={t('label.enter-entity', {
              entity: t('label.description'),
            })}
            value={description}
            visible={Boolean(isEdit)}
            onCancel={onCancel}
            onSave={onDescriptionUpdate}
          />
        </div>
      </Space>
    </>
  );

  return wrapInCard ? <Card>{content}</Card> : content;
};

export default DescriptionV1;
